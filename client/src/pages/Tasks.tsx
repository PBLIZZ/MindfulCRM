import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  Calendar as CalendarIcon,
  Clock,
  User,
  Bot,
  CheckCircle,
  Circle,
  MoreHorizontal,
  Lightbulb,
  Target,
  TrendingUp,
  AlertCircle,
  Filter,
  Search,
} from 'lucide-react';
import { format } from 'date-fns';

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'waiting_approval';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  owner: 'user' | 'ai_assistant';
  dueDate?: string;
  completedAt?: string;
  estimatedMinutes?: number;
  actualMinutes?: number;
  assignedContactIds?: string[];
  tags?: string[];
  projectId?: string;
  parentTaskId?: string;
  isAiGenerated: boolean;
  requiresApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  color: string;
  isArchived: boolean;
  createdAt: string;
}

interface AiSuggestion {
  id: string;
  type: string;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  createdAt: string;
}

export default function Tasks() {
  const [selectedTab, setSelectedTab] = useState('tasks');
  const [taskFilter, setTaskFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [selectedProjectFilter, setSelectedProjectFilter] = useState('all');

  const queryClient = useQueryClient();

  // Fetch data
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({
    queryKey: ['/api/tasks'],
    queryFn: () => apiRequest('/api/tasks'),
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['/api/projects'],
    queryFn: () => apiRequest('/api/projects'),
  });

  const { data: aiSuggestions = [] } = useQuery({
    queryKey: ['/api/ai-suggestions'],
    queryFn: () => apiRequest('/api/ai-suggestions'),
  });

  const { data: analytics } = useQuery({
    queryKey: ['/api/tasks/analytics'],
    queryFn: () => apiRequest('/api/tasks/analytics'),
  });

  // Filter tasks
  const filteredTasks = tasks.filter((task: Task) => {
    const matchesSearch =
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = taskFilter === 'all' || task.status === taskFilter;
    const matchesProject =
      selectedProjectFilter === 'all' || task.projectId === selectedProjectFilter;

    return matchesSearch && matchesStatus && matchesProject;
  });

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      case 'low':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'waiting_approval':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className='container mx-auto p-6'>
      <div className='flex justify-between items-center mb-6'>
        <div>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-white'>Task Management</h1>
          <p className='text-gray-600 dark:text-gray-400'>
            Manage your wellness practice with AI-powered task assistance
          </p>
        </div>
        <div className='flex gap-2'>
          <Dialog open={showCreateProject} onOpenChange={setShowCreateProject}>
            <DialogTrigger asChild>
              <Button variant='outline'>
                <Plus className='h-4 w-4 mr-2' />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <CreateProjectDialog onClose={() => setShowCreateProject(false)} />
            </DialogContent>
          </Dialog>

          <Dialog open={showCreateTask} onOpenChange={setShowCreateTask}>
            <DialogTrigger asChild>
              <Button>
                <Plus className='h-4 w-4 mr-2' />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className='max-w-2xl'>
              <CreateTaskDialog projects={projects} onClose={() => setShowCreateTask(false)} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Analytics Cards */}
      {analytics && (
        <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6'>
          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Total Tasks</CardTitle>
              <Target className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{analytics.totalTasks}</div>
              <p className='text-xs text-muted-foreground'>{analytics.pendingTasks} pending</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Completion Rate</CardTitle>
              <TrendingUp className='h-4 w-4 text-muted-foreground' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{analytics.completionRate}%</div>
              <Progress value={parseFloat(analytics.completionRate)} className='mt-2' />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>Overdue Tasks</CardTitle>
              <AlertCircle className='h-4 w-4 text-red-500' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold text-red-600'>{analytics.overdueTasks}</div>
              <p className='text-xs text-muted-foreground'>{analytics.todaysTasks} due today</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className='flex flex-row items-center justify-between space-y-0 pb-2'>
              <CardTitle className='text-sm font-medium'>AI Assistant</CardTitle>
              <Bot className='h-4 w-4 text-blue-500' />
            </CardHeader>
            <CardContent>
              <div className='text-2xl font-bold'>{analytics.aiTasksInProgress}</div>
              <p className='text-xs text-muted-foreground'>tasks in progress</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className='w-full'>
        <TabsList className='grid w-full grid-cols-3'>
          <TabsTrigger value='tasks' className='flex items-center gap-2'>
            <CheckCircle className='h-4 w-4' />
            Tasks
          </TabsTrigger>
          <TabsTrigger value='suggestions' className='flex items-center gap-2'>
            <Lightbulb className='h-4 w-4' />
            AI Suggestions (
            {aiSuggestions.filter((s: AiSuggestion) => s.status === 'pending').length})
          </TabsTrigger>
          <TabsTrigger value='projects' className='flex items-center gap-2'>
            <Target className='h-4 w-4' />
            Projects
          </TabsTrigger>
        </TabsList>

        <TabsContent value='tasks' className='mt-6'>
          <TasksTab
            tasks={filteredTasks}
            projects={projects}
            isLoading={tasksLoading}
            taskFilter={taskFilter}
            setTaskFilter={setTaskFilter}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            selectedProjectFilter={selectedProjectFilter}
            setSelectedProjectFilter={setSelectedProjectFilter}
            getPriorityColor={getPriorityColor}
            getStatusColor={getStatusColor}
          />
        </TabsContent>

        <TabsContent value='suggestions' className='mt-6'>
          <SuggestionsTab suggestions={aiSuggestions} />
        </TabsContent>

        <TabsContent value='projects' className='mt-6'>
          <ProjectsTab projects={projects} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Tasks Tab Component
function TasksTab({
  tasks,
  projects,
  isLoading,
  taskFilter,
  setTaskFilter,
  searchTerm,
  setSearchTerm,
  selectedProjectFilter,
  setSelectedProjectFilter,
  getPriorityColor,
  getStatusColor,
}: any) {
  const queryClient = useQueryClient();

  const updateTaskMutation = useMutation({
    mutationFn: ({ taskId, updates }: { taskId: string; updates: any }) =>
      apiRequest(`/api/tasks/${taskId}`, { method: 'PATCH', body: updates }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/analytics'] });
      toast({ title: 'Task updated successfully' });
    },
  });

  const toggleTaskStatus = (task: Task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    const updates: any = { status: newStatus };

    if (newStatus === 'completed') {
      updates.completedAt = new Date().toISOString();
    } else {
      updates.completedAt = null;
    }

    updateTaskMutation.mutate({ taskId: task.id, updates });
  };

  if (isLoading) {
    return <div className='text-center py-8'>Loading tasks...</div>;
  }

  return (
    <div className='space-y-4'>
      {/* Filters */}
      <div className='flex flex-wrap gap-4 items-center'>
        <div className='flex items-center gap-2'>
          <Search className='h-4 w-4 text-gray-500' />
          <Input
            placeholder='Search tasks...'
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className='w-64'
          />
        </div>

        <Select value={taskFilter} onValueChange={setTaskFilter}>
          <SelectTrigger className='w-40'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Status</SelectItem>
            <SelectItem value='pending'>Pending</SelectItem>
            <SelectItem value='in_progress'>In Progress</SelectItem>
            <SelectItem value='completed'>Completed</SelectItem>
            <SelectItem value='waiting_approval'>Waiting Approval</SelectItem>
          </SelectContent>
        </Select>

        <Select value={selectedProjectFilter} onValueChange={setSelectedProjectFilter}>
          <SelectTrigger className='w-40'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>All Projects</SelectItem>
            {projects.map((project: Project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Task List */}
      <div className='space-y-3'>
        {tasks.length === 0 ? (
          <Card>
            <CardContent className='text-center py-8'>
              <CheckCircle className='h-12 w-12 text-gray-400 mx-auto mb-4' />
              <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>
                No tasks found
              </h3>
              <p className='text-gray-600 dark:text-gray-400'>
                Create your first task or adjust your filters to see existing tasks.
              </p>
            </CardContent>
          </Card>
        ) : (
          tasks.map((task: Task) => (
            <Card key={task.id} className='hover:shadow-md transition-shadow'>
              <CardContent className='p-4'>
                <div className='flex items-start justify-between'>
                  <div className='flex items-start gap-3 flex-1'>
                    <button
                      onClick={() => toggleTaskStatus(task)}
                      className='mt-1 focus:outline-none'
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle className='h-5 w-5 text-green-500' />
                      ) : (
                        <Circle className='h-5 w-5 text-gray-400 hover:text-green-500' />
                      )}
                    </button>

                    <div className='flex-1'>
                      <div className='flex items-center gap-2 mb-1'>
                        <h3
                          className={`font-medium ${
                            task.status === 'completed'
                              ? 'line-through text-gray-500'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {task.title}
                        </h3>
                        <div
                          className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`}
                        />
                        {task.owner === 'ai_assistant' && <Bot className='h-4 w-4 text-blue-500' />}
                        {task.isAiGenerated && (
                          <Badge variant='secondary' className='text-xs'>
                            AI
                          </Badge>
                        )}
                      </div>

                      {task.description && (
                        <p className='text-sm text-gray-600 dark:text-gray-400 mb-2'>
                          {task.description}
                        </p>
                      )}

                      <div className='flex items-center gap-4 text-sm text-gray-500'>
                        <Badge className={getStatusColor(task.status)}>
                          {task.status.replace('_', ' ')}
                        </Badge>

                        {task.dueDate && (
                          <div className='flex items-center gap-1'>
                            <CalendarIcon className='h-3 w-3' />
                            {format(new Date(task.dueDate), 'MMM d')}
                          </div>
                        )}

                        {task.assignedContactIds && task.assignedContactIds.length > 0 && (
                          <div className='flex items-center gap-1'>
                            <User className='h-3 w-3' />
                            {task.assignedContactIds.length} contacts
                          </div>
                        )}

                        {task.estimatedMinutes && (
                          <div className='flex items-center gap-1'>
                            <Clock className='h-3 w-3' />
                            {task.estimatedMinutes}m
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant='ghost' size='sm'>
                        <MoreHorizontal className='h-4 w-4' />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align='end'>
                      <DropdownMenuItem onClick={() => {}}>Edit Task</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => {}}>View Details</DropdownMenuItem>
                      <DropdownMenuItem className='text-red-600'>Delete Task</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// AI Suggestions Tab Component
function SuggestionsTab({ suggestions }: { suggestions: AiSuggestion[] }) {
  const queryClient = useQueryClient();

  const approveSuggestionMutation = useMutation({
    mutationFn: (suggestionId: string) =>
      apiRequest(`/api/ai-suggestions/${suggestionId}/approve`, { method: 'PATCH' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-suggestions'] });
      toast({ title: 'Suggestion approved and executed' });
    },
  });

  const rejectSuggestionMutation = useMutation({
    mutationFn: ({ suggestionId, reason }: { suggestionId: string; reason: string }) =>
      apiRequest(`/api/ai-suggestions/${suggestionId}/reject`, {
        method: 'PATCH',
        body: { reason },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/ai-suggestions'] });
      toast({ title: 'Suggestion rejected' });
    },
  });

  const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');

  return (
    <div className='space-y-4'>
      {pendingSuggestions.length === 0 ? (
        <Card>
          <CardContent className='text-center py-8'>
            <Lightbulb className='h-12 w-12 text-gray-400 mx-auto mb-4' />
            <h3 className='text-lg font-medium text-gray-900 dark:text-white mb-2'>
              No pending suggestions
            </h3>
            <p className='text-gray-600 dark:text-gray-400'>
              Your AI assistant will analyze your data and create suggestions that appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        pendingSuggestions.map((suggestion: AiSuggestion) => (
          <Card key={suggestion.id}>
            <CardHeader>
              <div className='flex items-start justify-between'>
                <div>
                  <CardTitle className='text-lg'>{suggestion.title}</CardTitle>
                  <CardDescription>{suggestion.description}</CardDescription>
                </div>
                <Badge
                  className={`ml-4 ${
                    suggestion.priority === 'high'
                      ? 'bg-red-100 text-red-800'
                      : suggestion.priority === 'medium'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-green-100 text-green-800'
                  }`}
                >
                  {suggestion.priority}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className='flex gap-3'>
                <Button
                  onClick={() => approveSuggestionMutation.mutate(suggestion.id)}
                  disabled={approveSuggestionMutation.isPending}
                >
                  Approve
                </Button>
                <Button
                  variant='outline'
                  onClick={() =>
                    rejectSuggestionMutation.mutate({
                      suggestionId: suggestion.id,
                      reason: 'Not needed at this time',
                    })
                  }
                  disabled={rejectSuggestionMutation.isPending}
                >
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

// Projects Tab Component
function ProjectsTab({ projects }: { projects: Project[] }) {
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
      {projects.map((project: Project) => (
        <Card key={project.id}>
          <CardHeader>
            <div className='flex items-center gap-2'>
              <div className='w-4 h-4 rounded-full' style={{ backgroundColor: project.color }} />
              <CardTitle className='text-lg'>{project.name}</CardTitle>
            </div>
            {project.description && <CardDescription>{project.description}</CardDescription>}
          </CardHeader>
          <CardContent>
            <p className='text-sm text-gray-500'>
              Created {format(new Date(project.createdAt), 'MMM d, yyyy')}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Create Task Dialog Component
function CreateTaskDialog({ projects, onClose }: { projects: Project[]; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [owner, setOwner] = useState('user');
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState<Date>();
  const [delegateToAI, setDelegateToAI] = useState(false);

  const queryClient = useQueryClient();

  const createTaskMutation = useMutation({
    mutationFn: (taskData: any) =>
      apiRequest('/api/tasks', {
        method: 'POST',
        body: taskData,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks/analytics'] });
      toast({ title: 'Task created successfully' });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast({ title: 'Please enter a task title', variant: 'destructive' });
      return;
    }

    const taskData = {
      title: title.trim(),
      description: description.trim(),
      priority,
      owner: delegateToAI ? 'ai_assistant' : 'user',
      projectId: projectId || undefined,
      dueDate: dueDate?.toISOString(),
      status: 'pending',
    };

    createTaskMutation.mutate(taskData);
  };

  return (
    <DialogHeader>
      <DialogTitle>Create New Task</DialogTitle>
      <DialogDescription>
        Create a task for yourself or delegate it to the AI assistant for processing.
      </DialogDescription>

      <form onSubmit={handleSubmit} className='space-y-4 pt-4'>
        <div>
          <Label htmlFor='title'>Title *</Label>
          <Input
            id='title'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder='Enter task title...'
            required
          />
        </div>

        <div>
          <Label htmlFor='description'>Description</Label>
          <Textarea
            id='description'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='Describe the task...'
            rows={3}
          />
        </div>

        <div className='grid grid-cols-2 gap-4'>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='low'>Low</SelectItem>
                <SelectItem value='medium'>Medium</SelectItem>
                <SelectItem value='high'>High</SelectItem>
                <SelectItem value='urgent'>Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder='Select project...' />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value=''>No project</SelectItem>
                {projects.map((project: Project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label>Due Date</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant='outline' className='w-full justify-start text-left font-normal'>
                <CalendarIcon className='mr-2 h-4 w-4' />
                {dueDate ? format(dueDate, 'PPP') : 'Pick a date'}
              </Button>
            </PopoverTrigger>
            <PopoverContent className='w-auto p-0'>
              <Calendar mode='single' selected={dueDate} onSelect={setDueDate} initialFocus />
            </PopoverContent>
          </Popover>
        </div>

        <div className='flex items-center space-x-2'>
          <Switch id='delegate' checked={delegateToAI} onCheckedChange={setDelegateToAI} />
          <Label htmlFor='delegate' className='flex items-center gap-2'>
            <Bot className='h-4 w-4' />
            Delegate to AI Assistant
          </Label>
        </div>

        <div className='flex gap-3 pt-4'>
          <Button type='submit' disabled={createTaskMutation.isPending} className='flex-1'>
            {createTaskMutation.isPending ? 'Creating...' : 'Create Task'}
          </Button>
          <Button type='button' variant='outline' onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </DialogHeader>
  );
}

// Create Project Dialog Component
function CreateProjectDialog({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const queryClient = useQueryClient();

  const createProjectMutation = useMutation({
    mutationFn: (projectData: any) =>
      apiRequest('/api/projects', {
        method: 'POST',
        body: projectData,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      toast({ title: 'Project created successfully' });
      onClose();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: 'Please enter a project name', variant: 'destructive' });
      return;
    }

    createProjectMutation.mutate({
      name: name.trim(),
      description: description.trim(),
      color,
    });
  };

  return (
    <DialogHeader>
      <DialogTitle>Create New Project</DialogTitle>
      <DialogDescription>
        Projects help you organize related tasks and track progress on larger goals.
      </DialogDescription>

      <form onSubmit={handleSubmit} className='space-y-4 pt-4'>
        <div>
          <Label htmlFor='name'>Project Name *</Label>
          <Input
            id='name'
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='Enter project name...'
            required
          />
        </div>

        <div>
          <Label htmlFor='description'>Description</Label>
          <Textarea
            id='description'
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder='Describe the project...'
            rows={3}
          />
        </div>

        <div>
          <Label htmlFor='color'>Color</Label>
          <div className='flex items-center gap-2'>
            <input
              type='color'
              id='color'
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className='w-10 h-10 rounded border border-gray-300 cursor-pointer'
            />
            <span className='text-sm text-gray-600'>{color}</span>
          </div>
        </div>

        <div className='flex gap-3 pt-4'>
          <Button type='submit' disabled={createProjectMutation.isPending} className='flex-1'>
            {createProjectMutation.isPending ? 'Creating...' : 'Create Project'}
          </Button>
          <Button type='button' variant='outline' onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </DialogHeader>
  );
}
