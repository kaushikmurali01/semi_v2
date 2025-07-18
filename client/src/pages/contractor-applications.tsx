import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { CalendarDays, Building2, User, FileText, ExternalLink, Edit, UserPlus, Users, Trash2, Search, Filter, SortAsc, SortDesc } from "lucide-react";
import { Link } from "wouter";
import { useState, useMemo } from "react";
import { apiRequest } from "@/lib/queryClient";
import { canManageContractorTeam, canEditApplicationPermissions } from "@/lib/permissions";
import ContractorTeamAssignmentDialog from "@/components/ContractorTeamAssignmentDialog";

interface ContractorUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  permissionLevel: string;
  isActive: boolean;
  company?: {
    id: number;
    name: string;
    shortName: string;
  };
}

interface AssignedApplication {
  id: number;
  applicationId: string;
  title: string;
  description: string;
  status: string;
  activityType: string;
  facilityName: string;
  facilityCode: string;
  companyName: string;
  companyShortName: string;
  assignedDate: string;
  assignedBy: string;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
  assignedToUsers?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    permissions: string[] | string;
  }[];
  // Legacy single user support
  assignedToUser?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export default function ContractorApplications() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<AssignedApplication | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"assignedDate" | "createdAt" | "applicationId">("assignedDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch current user
  const { data: user } = useQuery<ContractorUser>({
    queryKey: ["/api/auth/user"],
  });

  // Fetch assigned applications
  const { data: applications = [], isLoading: applicationsLoading } = useQuery<AssignedApplication[]>({
    queryKey: ["/api/applications"],
    enabled: !!user?.id,
  });

  // Fetch team members
  const { data: teamMembers = [] } = useQuery<ContractorUser[]>({
    queryKey: ["/api/contractor/team"],
    enabled: !!user?.id,
  });

  // Keep removeAssignmentMutation for trash icon functionality

  const removeAssignmentMutation = useMutation({
    mutationFn: async ({ applicationId, userId }: { applicationId: number; userId: string }) => {
      return apiRequest(`/api/contractor/applications/${applicationId}/unassign`, "POST", { userId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/applications"] });
      toast({
        title: "Success",
        description: "Team member removed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove team member",
        variant: "destructive",
      });
    },
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ applicationId, userId, permissions }: { applicationId: number; userId: string; permissions: string[] }) => {
      return apiRequest(`/api/contractor/applications/${applicationId}/update-permissions`, 'POST', { userId, permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/applications'] });
      toast({
        title: "Permissions updated",
        description: "Team member permissions have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update permissions",
        variant: "destructive",
      });
    },
  });

  // Check permissions
  const canManageTeam = user && canManageContractorTeam(user);
  const canEditPermissions = user && canEditApplicationPermissions(user);

  // Debug logging
  console.log('[CONTRACTOR APPLICATIONS] User:', user);
  console.log('[CONTRACTOR APPLICATIONS] Applications:', applications);
  console.log('[CONTRACTOR APPLICATIONS] Team members:', teamMembers);
  console.log('[CONTRACTOR APPLICATIONS] Can edit permissions:', canEditPermissions);

  // Filter and sort applications
  const filteredAndSortedApplications = useMemo(() => {
    let filtered = applications.filter(app => {
      const searchMatch = searchTerm === "" || 
        app.applicationId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.facilityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        app.companyName.toLowerCase().includes(searchTerm.toLowerCase());
      
      const statusMatch = filterStatus === "all" || app.status === filterStatus;
      
      return searchMatch && statusMatch;
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "assignedDate":
          comparison = new Date(a.assignedDate).getTime() - new Date(b.assignedDate).getTime();
          break;
        case "createdAt":
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case "applicationId":
          comparison = a.applicationId.localeCompare(b.applicationId);
          break;
      }
      return sortOrder === "desc" ? -comparison : comparison;
    });

    return filtered;
  }, [applications, searchTerm, filterStatus, sortBy, sortOrder]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "draft": return "bg-gray-100 text-gray-800 border-gray-200";
      case "in_progress": return "bg-blue-100 text-blue-800 border-blue-200";
      case "submitted": return "bg-green-100 text-green-800 border-green-200";
      case "under_review": return "bg-yellow-100 text-yellow-800";
      case "approved": return "bg-emerald-100 text-emerald-800";
      case "rejected": return "bg-red-100 text-red-800";
      case "needs_revision": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getActivityTypeColor = (activityType: string) => {
    switch (activityType) {
      case "FRA": return "bg-purple-100 text-purple-800";
      case "SEM": return "bg-indigo-100 text-indigo-800";
      case "EAA": return "bg-cyan-100 text-cyan-800";
      case "EMIS": return "bg-teal-100 text-teal-800";
      case "CR": return "bg-amber-100 text-amber-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (applicationsLoading) {
    return (
      <div className="p-6">
        <div className="space-y-4">
          <div className="h-8 bg-gray-200 rounded animate-pulse" />
          <div className="grid gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Applications</h1>
          <p className="text-muted-foreground">
            Manage applications assigned to your contracting team
          </p>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <Card className="border-blue-200 bg-blue-50/30">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search applications..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Status Filter */}
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="needs_revision">Needs Revision</SelectItem>
                <SelectItem value="revision_required">Revision Required</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort By */}
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assignedDate">Assignment Date</SelectItem>
                <SelectItem value="createdAt">Creation Date</SelectItem>
                <SelectItem value="applicationId">Application ID</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Order */}
            <Button
              variant="outline"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
              className="flex items-center gap-2"
            >
              {sortOrder === "asc" ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
              {sortOrder === "asc" ? "Ascending" : "Descending"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Showing {filteredAndSortedApplications.length} of {applications.length} applications
        </p>
      </div>

      {filteredAndSortedApplications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Applications Assigned</h3>
            <p className="text-gray-500 text-center max-w-md">
              You don't have any applications assigned yet. When participating companies assign work to your contracting company, they will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {filteredAndSortedApplications.map((application) => (
            <Card key={application.id} className="hover:shadow-lg transition-all duration-200 border-l-4 border-l-blue-500">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <CardTitle className="text-xl font-bold text-gray-900">
                        {application.applicationId}
                      </CardTitle>
                      <Badge className={getActivityTypeColor(application.activityType)} variant="outline">
                        {application.activityType}
                      </Badge>
                    </div>
                    <CardDescription className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-gray-700">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">{application.facilityName}</span>
                        <span className="text-gray-500">•</span>
                        <span>{application.companyName}</span>
                      </div>
                    </CardDescription>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <Badge className={getStatusColor(application.status)} variant="outline">
                      {application.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                    <Badge variant="outline" className={getActivityTypeColor(application.activityType)}>
                      {application.activityType}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium text-gray-900 mb-2">{application.title}</h3>
                    <p className="text-sm text-gray-600">{application.description}</p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">
                          Assigned: {new Date(application.assignedDate).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600">
                          Your Permissions: {
                            user?.role === 'contractor_account_owner' || user?.role === 'contractor_individual'
                              ? 'Account Owner (View & Edit Access)'
                              : user?.role === 'contractor_manager'
                              ? 'Manager (View & Edit Access)'
                              : (user?.role === 'contractor_team_member' && user?.permissionLevel === 'manager')
                              ? 'Manager (View & Edit Access)'
                              : (application.permissions && application.permissions.length > 0 
                                ? (application.permissions.includes('edit') ? 'Edit Access' : 'View Only')
                                : 'View Only')
                          }
                        </span>
                      </div>
                    </div>

                    {/* Team Assignment Section */}
                    {(user?.role === 'contractor_individual' || 
                      user?.role === 'contractor_account_owner' || 
                      user?.role === 'contractor_manager' ||
                      (user?.role === 'contractor_team_member' && user?.permissionLevel === 'manager')) && (
                      <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium text-blue-900 flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            Team Assignments
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedApplication(application);
                              setAssignDialogOpen(true);
                            }}
                            className="border-blue-300 text-blue-700 hover:bg-blue-100"
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add Team Member
                          </Button>
                        </div>
                        
                        {/* Display assigned team members (excluding current user if they are account owner) */}
                        {application.assignedToUsers && application.assignedToUsers.length > 0 ? (
                          <div className="space-y-2">
                            {application.assignedToUsers
                              .filter(assignedUser => 
                                // Filter out current user if they are account owner/manager (they have automatic permissions)
                                assignedUser.id !== user?.id || 
                                !['contractor_individual', 'contractor_account_owner', 'contractor_manager'].includes(user?.role || '')
                              )
                              .map((assignedUser, index) => (
                              <div key={`${assignedUser.id}-${application.id}-${index}`} className="flex items-center justify-between bg-white rounded-md p-3 border border-blue-200">
                                <div className="flex items-center gap-3">
                                  <User className="h-4 w-4 text-blue-600" />
                                  <div>
                                    <div className="font-medium text-sm text-gray-900">
                                      {assignedUser.firstName} {assignedUser.lastName}
                                    </div>
                                    <div className="text-xs text-gray-600">{assignedUser.email}</div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex gap-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {Array.isArray(assignedUser.permissions) ? 
                                        (assignedUser.permissions.includes('edit') ? 'Edit' : 'View') :
                                        (assignedUser.permissions === 'edit' ? 'Edit' : 'View')
                                      }
                                    </Badge>
                                  </div>
                                  {canEditPermissions && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          const currentPerms = assignedUser.permissions;
                                          const hasEdit = Array.isArray(currentPerms) ? 
                                            currentPerms.includes('edit') : 
                                            currentPerms === 'edit';
                                          const newPerms = hasEdit ? ['view'] : ['edit'];
                                          
                                          updatePermissionsMutation.mutate({
                                            applicationId: application.id,
                                            userId: assignedUser.id,
                                            permissions: newPerms
                                          });
                                        }}
                                        className="h-7 px-2 text-xs"
                                      >
                                        {Array.isArray(assignedUser.permissions) ? 
                                          (assignedUser.permissions.includes('edit') ? 'Remove Edit' : 'Add Edit') :
                                          (assignedUser.permissions === 'edit' ? 'Remove Edit' : 'Add Edit')
                                        }
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          if (confirm(`Remove ${assignedUser.firstName} ${assignedUser.lastName} from this application?`)) {
                                            removeAssignmentMutation.mutate({
                                              applicationId: application.id,
                                              userId: assignedUser.id
                                            });
                                          }
                                        }}
                                        className="h-7 w-7 p-0 text-red-600 hover:text-red-800 hover:bg-red-50"
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          // Show message when no team members (excluding account owners) are assigned
                          <div className="text-center py-3 text-sm text-gray-500 bg-white rounded-md border border-blue-200">
                            No team members assigned yet
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-4 border-t">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/applications/${application.id}`}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Details
                      </Link>
                    </Button>
                    
                    {(user?.role === 'contractor_account_owner' || 
                      user?.role === 'contractor_manager' || 
                      (user?.role === 'contractor_team_member' && user?.permissionLevel === 'manager') ||
                      (user?.role === 'contractor_team_member' && 
                       application.permissions && application.permissions.includes('edit'))) && (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/applications/${application.id}`}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Application
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Radio Button Team Assignment Dialog */}
      <ContractorTeamAssignmentDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        applicationId={selectedApplication?.id?.toString()}
        applicationTitle={selectedApplication?.applicationId}
      />
    </div>
  );
}