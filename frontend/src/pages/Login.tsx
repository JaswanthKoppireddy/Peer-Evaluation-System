import { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';
import Button from '../components/Button';
import { UserCircle2 } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  captcha: z.string().min(1, 'Please complete the CAPTCHA'),
});

type LoginForm = z.infer<typeof loginSchema>;

const Login = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { register, handleSubmit, setValue } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    setValue('captcha', 'verified', { shouldValidate: true });
  }, [setValue]);

  const onSubmit = async (data: LoginForm) => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', {
        email: data.email,
        password: data.password,
      });

      login(response.data);
      toast.success('Logged in successfully');
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onError = (errors: any) => {
    if (errors.captcha) {
      toast.warning(errors.captcha.message);
    }
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-8 dashboard-shell">
      <div className="w-full max-w-[430px] shell-surface p-7 sm:p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full text-white flex items-center justify-center" style={{ background: 'linear-gradient(90deg, var(--brand-a), var(--brand-b))' }}>
            <UserCircle2 size={28} />
          </div>
          <div className="text-center">
            <h1 className="text-[49px] font-bold leading-tight">Welcome Back</h1>
            <p className="mt-2 text-[23px]" style={{ color: 'var(--muted-text)' }}>Please sign in to your account</p>
          </div>
        </div>

        <form className="space-y-5 mt-8" onSubmit={handleSubmit(onSubmit, onError)}>
          <div className="grid grid-cols-[95px_1fr] items-center gap-3">
            <label className="text-[22px] font-medium">Email</label>
            <input
              type="email"
              className="form-input"
              placeholder="Enter your email"
              {...register('email')}
            />
          </div>
          <div className="grid grid-cols-[95px_1fr] items-center gap-3">
            <label className="text-[22px] font-medium">Password</label>
            <input
              type="password"
              className="form-input"
              placeholder="Enter your password"
              {...register('password')}
            />
          </div>
          <div className="text-right">
            <Link to="#" className="text-sm underline" style={{ color: '#5f6488' }}>Forgot password?</Link>
          </div>
          <Button type="submit" className="w-full gradient-btn h-11 rounded-[9px] text-[24px]" isLoading={isLoading}>
            Login
          </Button>
        </form>

        <p className="mt-8 text-center text-sm" style={{ color: 'var(--muted-text)' }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" className="underline" style={{ color: '#5f6488' }}>Register</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
