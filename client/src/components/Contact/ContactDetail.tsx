import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.js";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs.js";
import { Progress } from "@/components/ui/progress.js";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.js";
import { Edit } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Contact, Interaction, Goal, Document } from "@shared/schema.js";

interface ContactWithDetails extends Contact {
  interactions: Interaction[];
  goals: Goal[];
  documents: Document[];
}

interface ContactDetailProps {
  contactId: string;
  onEditContact?: (contact: ContactWithDetails) => void;
}

export default function ContactDetail({ contactId, onEditContact }: ContactDetailProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/contacts", contactId],
  }) as { data: ContactWithDetails, isLoading: boolean };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-40 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Contact not found</p>
        </CardContent>
      </Card>
    );
  }

  const contact = data;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      active: "default",
      inactive: "secondary",
      archived: "destructive",
    };
    return variants[status] || "default";
  };

  const getInitials = (name: string) => {
    return name
      ?.split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase() || '?'
  };

  return (
    <div className="space-y-6">
      {/* Contact Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={contact.avatarUrl ?? undefined} alt={contact.name} />
                <AvatarFallback className="text-lg">
                  {getInitials(contact.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <CardTitle className="text-xl">{contact.name}</CardTitle>
                <p className="text-muted-foreground">{contact.email}</p>
                {contact.phone && (
                  <p className="text-sm text-muted-foreground">{contact.phone}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={getStatusBadge(contact.status ?? 'active')}>
                {contact.status ?? 'Unknown'}
              </Badge>
              {onEditContact && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEditContact(contact)}
                  className="flex items-center gap-2"
                >
                  <Edit className="h-4 w-4" />
                  Edit Contact
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Contact Details */}
      <Card>
        <CardContent className="p-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="goals">Goals</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Contact Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Email:</span> {contact.email}</p>
                    {contact.phone && (
                      <p><span className="font-medium">Phone:</span> {contact.phone}</p>
                    )}
                    <p>
                      <span className="font-medium">Last Contact:</span>{" "}
                      {contact.lastContact
                        ? formatDistanceToNow(new Date(contact.lastContact), { addSuffix: true })
                        : "Never"}
                    </p>
                    <p><span className="font-medium">Status:</span> {contact.status ?? 'Unknown'}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Engagement Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <p><span className="font-medium">Sentiment:</span> {contact.sentiment ?? 'N/A'}/5</p>
                    <p><span className="font-medium">Trend:</span> {contact.engagementTrend ?? 'Unknown'}</p>
                    <p><span className="font-medium">Interactions:</span> {contact.interactions?.length || 0}</p>
                    <p><span className="font-medium">Goals:</span> {contact.goals?.length || 0}</p>
                  </div>
                </div>
              </div>

              {contact.notes && (
                <div>
                  <h4 className="font-medium mb-2">Notes</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {contact.notes}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="timeline" className="space-y-4 mt-6">
              {contact.interactions && contact.interactions.length > 0 ? (
                contact.interactions.map((interaction: Interaction) => (
                  <div key={interaction.id} className="border-l-2 border-primary pl-4 pb-4">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">{interaction.subject ?? interaction.type}</h5>
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(interaction.timestamp), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {interaction.content ?? 'No content'}
                    </p>
                    <div className="flex items-center space-x-2 mt-2">
                      <Badge variant="outline" className="text-xs">
                        {interaction.type}
                      </Badge>
                      {interaction.source && (
                        <Badge variant="outline" className="text-xs">
                          {interaction.source}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No interactions found
                </div>
              )}
            </TabsContent>

            <TabsContent value="goals" className="space-y-4 mt-6">
              {contact.goals && contact.goals.length > 0 ? (
                contact.goals.map((goal: Goal) => (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">{goal.title}</h5>
                      <Badge variant={goal.status === "completed" ? "default" : "secondary"}>
                        {goal.status ?? 'Unknown'}
                      </Badge>
                    </div>
                    {goal.description && (
                      <p className="text-sm text-muted-foreground">{goal.description}</p>
                    )}
                    <div className="flex items-center justify-between text-sm">
                      <span>Progress: {goal.currentValue ?? 0}/{goal.targetValue ?? 0} {goal.unit ?? ''}</span>
                      <span>{goal.targetValue ? Math.round(((goal.currentValue ?? 0) / goal.targetValue) * 100) : 0}%</span>
                    </div>
                    <Progress value={goal.targetValue ? ((goal.currentValue ?? 0) / goal.targetValue) * 100 : 0} className="h-2" />
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No goals set
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="space-y-4 mt-6">
              {contact.documents && contact.documents.length > 0 ? (
                contact.documents.map((document: Document) => (
                  <div key={document.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <h5 className="font-medium">{document.name ?? 'Untitled Document'}</h5>
                      <p className="text-sm text-muted-foreground">{document.type ?? 'Unknown'}</p>
                    </div>
                    {document.url && (
                      <a
                        href={document.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline text-sm"
                      >
                        View
                      </a>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No documents found
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
