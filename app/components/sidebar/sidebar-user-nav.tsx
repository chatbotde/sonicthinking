import type { User as UserType } from '~/types';
import { Form, useSubmit } from '@remix-run/react';

import { Avatar, AvatarFallback, AvatarImage } from '~/components/ui/avatar';
import { Button } from '~/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '~/components/ui/dialog';
import { useTheme } from '~/hooks/use-theme';
import { useState } from 'react';
import { 
  Card, 
  CardContent,
} from '~/components/ui/card';
import { Badge } from '~/components/ui/badge';
import { Mail, Phone, LogOut, Trash2, UserX, AlertTriangle, Settings, Info, User, Download, Upload, Bell, Globe, Lock, Keyboard, X, Coffee, PanelRight } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from "~/components/ui/tooltip";
import { Switch } from '~/components/ui/switch';
import { useChat } from '~/context/chat-context';
import { AVAILABLE_LLMS } from '~/lib/ai/models.config';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select';
import { ModeToggle } from '~/components/mode-toggle';

export function SidebarUserNav({ user }: { user: UserType }) {
  const { theme, setTheme } = useTheme();
  const { selectedModel, setSelectedModel } = useChat();
  const [profileOpen, setProfileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [improveModel, setImproveModel] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [language, setLanguage] = useState("english");
  const [autoSave, setAutoSave] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutAllConfirmOpen, setLogoutAllConfirmOpen] = useState(false);
  const submit = useSubmit();
  
  // Shared logout handler
  const handleLogout = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoggingOut(true);
    setProfileOpen(false);
    setSettingsOpen(false);
    setLogoutConfirmOpen(false);
    setLogoutAllConfirmOpen(false);
    
    submit(event.currentTarget, { replace: true });
    
    // Force a page reload after submission to ensure client state is reset
    setTimeout(() => {
      window.location.href = "/";
    }, 500);
  };

  return (
    <div className="flex items-center justify-between px-2">
      <DropdownMenu
        onOpenChange={(openMenu) => {
          if (!openMenu) setProfileOpen(false);
        }}
      >
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-auto w-full justify-start p-2" aria-label="Open user menu">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.avatar_url} alt={user.name || user.email} />
              <AvatarFallback>
                {user.name ? user.name[0] : user.email[0]}
              </AvatarFallback>
            </Avatar>
            <span className="ml-2 line-clamp-1 text-left text-sm">
              {user.name || user.email}
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs leading-none text-muted-foreground">
                {user.email}
              </p>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          
          {/* Theme Toggle as a DropdownMenuItem */}
          <DropdownMenuItem asChild>
            <Button 
              variant="ghost" 
              className="w-full justify-start cursor-pointer"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
            </Button>
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={e => { e.preventDefault(); setProfileOpen(true); }}
          >
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={e => { e.preventDefault(); setSettingsOpen(true); }}
          >
            Settings
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={e => { 
              e.preventDefault(); 
              setLogoutConfirmOpen(true); 
            }}
          >
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      
      {/* Logout Confirmation Dialog */}
      <Dialog open={logoutConfirmOpen} onOpenChange={setLogoutConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to logout? You'll need to sign in again to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between items-center gap-4 sm:justify-between">
            <Button variant="outline" onClick={() => setLogoutConfirmOpen(false)}>
              Cancel
            </Button>
            <Form 
              method="post" 
              action="/logout"
              onSubmit={handleLogout}
            >
              <input type="hidden" name="intent" value="logout" />
              <Button
                type="submit"
                variant="destructive"
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Logging out..." : "Confirm Logout"}
              </Button>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Logout All Devices Confirmation Dialog */}
      <Dialog open={logoutAllConfirmOpen} onOpenChange={setLogoutAllConfirmOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirm Logout from All Devices</DialogTitle>
            <DialogDescription>
              This will sign you out from all devices where you're currently logged in. Are you sure you want to continue?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex justify-between items-center gap-4 sm:justify-between">
            <Button variant="outline" onClick={() => setLogoutAllConfirmOpen(false)}>
              Cancel
            </Button>
            <Form 
              method="post" 
              action="/logout"
              onSubmit={handleLogout}
            >
              <input type="hidden" name="intent" value="logout-all" />
              <Button
                type="submit"
                variant="destructive"
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Logging out..." : "Confirm Logout"}
              </Button>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-sm p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="text-xl flex items-center gap-2">
              <User size={18} className="text-primary" />
              User Profile
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              View your account information.
            </DialogDescription>
          </DialogHeader>
          
          <div className="px-6 py-4 overflow-y-auto">
            <Card className="overflow-hidden">
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6">
                <div className="flex flex-col items-center">
                  <div className="relative mb-3">
                    <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                      <AvatarImage src={user.avatar_url} alt={user.name || user.email} />
                      <AvatarFallback className="text-3xl">
                        {user.name ? user.name[0] : user.email[0]}
                      </AvatarFallback>
                    </Avatar>
                    {/* Google icon as badge */}
                    <Badge className="absolute -bottom-1 -right-1 rounded-full p-1.5 bg-white text-black">
                      <svg width="18" height="18" viewBox="0 0 48 48">
                        <g>
                          <circle cx="24" cy="24" r="11" fill="#fff"/>
                          <path fill="#4285F4" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.6 4.3-5.7 7-11.3 7-6.6 0-12-5.4-12-12s5.4-12 12-12c2.7 0 5.2.9 7.2 2.4l6-6C34.5 5.5 29.6 3.5 24 3.5 12.7 3.5 3.5 12.7 3.5 24S12.7 44.5 24 44.5c11 0 20.5-8.5 20.5-20.5 0-1.4-.1-2.7-.4-4z"/>
                          <path fill="#34A853" d="M6.3 14.1l6.6 4.8C14.5 16.1 18.9 13 24 13c2.7 0 5.2.9 7.2 2.4l6-6C34.5 5.5 29.6 3.5 24 3.5c-7.6 0-14.1 4.3-17.7 10.6z"/>
                          <path fill="#FBBC05" d="M24 44.5c5.6 0 10.5-1.9 14.4-5.2l-6.6-5.4c-2 1.4-4.5 2.1-7.8 2.1-5.6 0-10.3-3.8-12-9l-6.6 5.1C7.9 40.2 15.4 44.5 24 44.5z"/>
                          <path fill="#EA4335" d="M43.6 20.5h-1.9V20H24v8h11.3c-1.3 3.5-4.7 6-8.3 6-5.6 0-10.3-3.8-12-9l-6.6 5.1C7.9 40.2 15.4 44.5 24 44.5c11 0 20.5-8.5 20.5-20.5 0-1.4-.1-2.7-.4-4z"/>
                        </g>
                      </svg>
                    </Badge>
                  </div>
                  <h2 className="text-2xl font-bold">{user.name}</h2>
                </div>
              </div>
              
              <CardContent className="p-6 space-y-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Mail size={16} className="text-primary" />
                    </div>
                    <span className="text-sm">{user.email}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2 rounded-full">
                      <Phone size={16} className="text-primary" />
                    </div>
                    <span className="text-sm text-muted-foreground">Not provided</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div className="p-4 border-t">
            <Button variant="outline" onClick={() => setProfileOpen(false)} className="w-full">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-lg p-0 max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b">
            <DialogTitle className="text-xl flex items-center gap-2">
              <Settings size={18} className="text-primary" />
              Settings
            </DialogTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-full h-8 w-8"
                >
                  <X size={16} />
                  <span className="sr-only">Close</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent>Close</TooltipContent>
            </Tooltip>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 space-y-8">
            {/* Appearance Section */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <PanelRight size={18} className="text-primary" />
                Interface
              </h3>
              <div className="rounded-lg border bg-card">
                <div className="p-5 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">Theme</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Choose your preferred appearance
                      </p>
                    </div>
                    <Button 
                      variant="outline"
                      size="sm"
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                      className="min-w-[100px] justify-center"
                    >
                      {theme === 'light' ? 'Dark Mode' : 'Light Mode'}
                    </Button>
                  </div>
                </div>
                
                <div className="p-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">Language</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Set your preferred language
                      </p>
                    </div>
                    <select
                      className="w-[100px] p-2 rounded-md border bg-background"
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                    >
                      <option value="english">English</option>
                      <option value="spanish">Español</option>
                      <option value="french">Français</option>
                      <option value="german">Deutsch</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Data Management */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Globe size={18} className="text-primary" />
                Data Management
              </h3>
              <div className="rounded-lg border bg-card">
                <div className="p-5 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">Auto-save</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Automatically save your thoughts as you type
                      </p>
                    </div>
                    <Switch checked={autoSave} onCheckedChange={setAutoSave} />
                  </div>
                </div>
                
                <div className="p-5 grid grid-cols-2 gap-3">
                  <Button variant="outline" className="flex items-center gap-2 justify-center">
                    <Download size={16} />
                    <span>Export data</span>
                  </Button>
                  <Button variant="outline" className="flex items-center gap-2 justify-center">
                    <Upload size={16} />
                    <span>Import data</span>
                  </Button>
                </div>
              </div>
            </div>
            
            {/* Privacy Section */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Lock size={18} className="text-primary" />
                Privacy & Security
              </h3>
              <div className="rounded-lg border bg-card">
                <div className="p-5 border-b">
                  <div className="flex justify-between items-start gap-4">
                    <div>
                      <h4 className="font-medium">Improve the model for everyone</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Your content may be used to improve our models for everyone. We take privacy seriously and remove personal info.
                      </p>
                    </div>
                    <Switch checked={improveModel} onCheckedChange={setImproveModel} />
                  </div>
                </div>
                
                <div className="p-5 border-b">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-medium">Notifications</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        Enable browser notifications for important updates
                      </p>
                    </div>
                    <Switch checked={notifications} onCheckedChange={setNotifications} />
                  </div>
                </div>
                
                <div className="p-5">
                  <div>
                    <h4 className="font-medium">Keyboard shortcuts</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      Configure keyboard shortcuts for faster navigation
                    </p>
                    <div className="mt-3">
                      <Button variant="outline" size="sm" className="flex items-center gap-2">
                        <Keyboard size={14} />
                        <span>View shortcuts</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Account Management Section */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-500" />
                Account Management
              </h3>
              <div className="rounded-lg border bg-card">
                <div className="p-5 border-b">
                  <Button 
                    variant="outline" 
                    className="w-full flex items-center gap-2 justify-center" 
                    size="default"
                    onClick={() => setLogoutAllConfirmOpen(true)}
                    disabled={isLoggingOut}
                  >
                    <LogOut size={16} />
                    <span>{isLoggingOut ? "Logging out..." : "Log out of all devices"}</span>
                  </Button>
                </div>
                
                <div className="p-5 space-y-4">
                  <div>
                    <h4 className="font-medium text-destructive mb-2">Danger Zone</h4>
                    <p className="text-sm text-muted-foreground">
                      These actions cannot be undone. Please proceed with caution.
                    </p>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 w-full flex items-center gap-2 justify-center">
                      <Trash2 size={16} />
                      <span>Delete all chats</span>
                    </Button>
                    <Button variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10 w-full flex items-center gap-2 justify-center">
                      <UserX size={16} />
                      <span>Delete account</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            {/* About Section */}
            <div>
              <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
                <Info size={18} className="text-primary" />
                About
              </h3>
              <div className="rounded-lg border bg-card">
                <div className="p-5 space-y-4">
                  <div>
                    <h4 className="font-medium">SonicThinking v1.0.0</h4>
                    <p className="text-sm text-muted-foreground mt-1">
                      An AI-powered thinking assistant to help you organize and expand your thoughts.
                    </p>
                    <p className="text-xs mt-4 text-muted-foreground">© 2023 SonicThinking. All rights reserved.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm">Terms of Service</Button>
                    <Button variant="outline" size="sm">Privacy Policy</Button>
                    <Button variant="outline" size="sm" className="flex items-center gap-2">
                      <Coffee size={14} />
                      <span>Support us</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}