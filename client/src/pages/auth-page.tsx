import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Utensils, Mail, Lock, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Senha é obrigatória"),
});

const registerSchema = insertUserSchema.extend({
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { 
      email: "", 
      password: "", 
      confirmPassword: "",
      name: "",
      role: "employee",
      transportType: "ônibus"
    },
  });

  // Redirect if already logged in
  if (user) {
    return <Redirect to={user.role === 'admin' ? '/admin' : '/'} />;
  }

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterForm) => {
    const { confirmPassword, ...userData } = data;
    registerMutation.mutate(userData);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4">
                <Utensils className="h-8 w-8 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Pastelaria 24h</h2>
              <p className="text-gray-600 mt-2">Sistema de Gestão de Turnos</p>
            </div>

            <div className="flex mb-6 bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  isLogin
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !isLogin
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Registrar
              </button>
            </div>

            {isLogin ? (
              <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                <div>
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    {...loginForm.register("email")}
                    className="mt-1"
                  />
                  {loginForm.formState.errors.email && (
                    <p className="text-sm text-red-600 mt-1">
                      {loginForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Senha
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...loginForm.register("password")}
                    className="mt-1"
                  />
                  {loginForm.formState.errors.password && (
                    <p className="text-sm text-red-600 mt-1">
                      {loginForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Mail className="h-4 w-4 mr-2" />
                  )}
                  Entrar
                </Button>
              </form>
            ) : (
              <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                <div>
                  <Label htmlFor="reg-name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    Nome Completo
                  </Label>
                  <Input
                    id="reg-name"
                    type="text"
                    placeholder="Seu nome"
                    {...registerForm.register("name")}
                    className="mt-1"
                  />
                  {registerForm.formState.errors.name && (
                    <p className="text-sm text-red-600 mt-1">
                      {registerForm.formState.errors.name.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    E-mail
                  </Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="seu@email.com"
                    {...registerForm.register("email")}
                    className="mt-1"
                  />
                  {registerForm.formState.errors.email && (
                    <p className="text-sm text-red-600 mt-1">
                      {registerForm.formState.errors.email.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="reg-password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Senha
                  </Label>
                  <Input
                    id="reg-password"
                    type="password"
                    placeholder="••••••••"
                    {...registerForm.register("password")}
                    className="mt-1"
                  />
                  {registerForm.formState.errors.password && (
                    <p className="text-sm text-red-600 mt-1">
                      {registerForm.formState.errors.password.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="confirm-password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    Confirmar Senha
                  </Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    {...registerForm.register("confirmPassword")}
                    className="mt-1"
                  />
                  {registerForm.formState.errors.confirmPassword && (
                    <p className="text-sm text-red-600 mt-1">
                      {registerForm.formState.errors.confirmPassword.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <User className="h-4 w-4 mr-2" />
                  )}
                  Registrar
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
