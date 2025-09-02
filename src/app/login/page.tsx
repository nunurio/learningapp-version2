import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { login, signup, requestPasswordReset, signinWithGithub } from "@/app/login/actions";
import Link from "next/link";

export const metadata = { title: "Login" };

export default function LoginPage() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign in to Learnify</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm">Email</label>
              <Input id="email" name="email" type="email" required />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm">Password</label>
              <Input id="password" name="password" type="password" required />
            </div>
            <div className="flex gap-2">
              <Button formAction={login} variant="default" className="flex-1">Log in</Button>
              <Button formAction={signup} variant="outline" className="flex-1">Sign up</Button>
            </div>
            <div className="flex items-center gap-2">
              <Button type="submit" formAction={requestPasswordReset} variant="ghost" className="px-0 text-sm">Forgot password?</Button>
              <span className="text-[hsl(var(--fg))]/50 text-sm">·</span>
              <Link href="/auth/reset-password" className="text-sm underline">I have a recovery link</Link>
            </div>
            <div className="pt-2">
              <Button type="submit" formAction={signinWithGithub} variant="outline" className="w-full">
                Continue with GitHub
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
