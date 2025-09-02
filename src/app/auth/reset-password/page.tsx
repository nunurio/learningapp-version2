import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updatePassword } from "./actions";

export const metadata = {
  title: "Reset Password",
};

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updatePassword} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm">New password</label>
              <Input id="password" name="password" type="password" required />
            </div>
            <div className="space-y-1">
              <label htmlFor="confirm" className="text-sm">Confirm password</label>
              <Input id="confirm" name="confirm" type="password" required />
            </div>
            <Button type="submit" variant="default" className="w-full">Update password</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

