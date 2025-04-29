import { Form, useNavigation, useSubmit } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { useState } from "react";

export function LogoutDialog() {
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [open, setOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const submit = useSubmit();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Logout
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Confirm Logout</DialogTitle>
          <DialogDescription>
            Are you sure you want to logout? You'll need to sign in again to access your account.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Form 
            method="post" 
            action="/logout"
            onSubmit={(event) => {
              event.preventDefault();
              setIsLoggingOut(true); // Set logging out state to true
              submit(event.currentTarget, { replace: true });
              // Force a page reload after submission to ensure client state is reset
              setTimeout(() => {
                window.location.href = "/";
              }, 500);
            }}
          >
            <Button
              type="submit"
              variant="destructive"
              disabled={isSubmitting || isLoggingOut}
            >
              {isSubmitting || isLoggingOut ? "Logging out..." : "Confirm Logout"}
            </Button>
          </Form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}