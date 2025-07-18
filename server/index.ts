import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Only send response if headers haven't been sent already
    if (!res.headersSent) {
      res.status(status).json({ message });
    }
    
    // Log the error but don't re-throw to prevent "ERR_HTTP_HEADERS_SENT"
    console.error('[ERROR]', err);
  });

  // Production vs Development setup
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!isProduction) {
    await setupVite(app, server);
  } else {
    // CRITICAL FIX: Import path and fs for production static serving
    const path = await import("path");
    const fs = await import("fs");
    
    // Serve static files from dist/public directory
    const distPath = path.resolve(import.meta.dirname, "public");
    
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      console.log('✅ Static files served from:', distPath);
    } else {
      console.error('❌ Build directory not found:', distPath);
    }
    
    // CRITICAL: Only serve index.html for non-API routes
    // This prevents API routes from being intercepted by the catch-all
    app.use("*", (req, res) => {
      // Don't serve index.html for API routes - let them 404 if not found
      if (req.originalUrl.startsWith('/api/')) {
        return res.status(404).json({ message: 'API endpoint not found' });
      }
      
      // For all other routes, serve index.html (React Router will handle client-side routing)
      if (fs.existsSync(distPath)) {
        res.sendFile(path.resolve(distPath, "index.html"));
      } else {
        res.status(500).json({ message: 'Build files not found' });
      }
    });
  }

  // Production-ready port configuration for Render deployment
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;
  const host = isProduction ? "0.0.0.0" : "127.0.0.1";
  
  server.listen({
    port,
    host
  }, () => {
    log(`SEMI application serving on ${isProduction ? 'production' : 'development'} at ${host}:${port}`);
    if (isProduction) {
      console.log('✅ Production mode: Static files served, PostgreSQL sessions enabled');
    } else {
      console.log('🛠️  Development mode: Vite HMR enabled');
    }
  });
})();
