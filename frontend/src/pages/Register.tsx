import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import api from '../api/axios';
import Button from '../components/Button';
import { UserCircle2 } from 'lucide-react';

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Must contain at least one number'),
  role: z.enum(['Student', 'TA', 'Teacher']),
  teacherUniqueId: z.string().optional(),
  captcha: z.string().min(1, 'Please check the box to confirm you are human'),
});

type RegisterForm = z.infer<typeof registerSchema>;

const Register = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string>('Student');
  const navigate = useNavigate();

  const { register, handleSubmit, watch, formState: { errors }, setValue } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: 'Student' },
  });

  const watchedRole = watch('role');
  useEffect(() => {
    setSelectedRole(watchedRole);
  }, [watchedRole]);
  useEffect(() => {
    setValue('captcha', 'verified', { shouldValidate: true });
  }, [setValue]);

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true);
    try {
      const payload: any = {
        name: data.name,
        email: data.email,
        password: data.password,
        role: data.role,
      };
      if (data.role === 'TA') {
        payload.teacherUniqueId = data.teacherUniqueId?.trim();
      }

      const response = await api.post('/auth/register', payload);
      toast.success(response.data.message || 'Account created successfully!');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to register. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const onError = (errs: any) => {
    if (errs.captcha) toast.warning(errs.captcha.message);
  };

  return (
    <div className="min-h-screen grid place-items-center px-4 py-8 dashboard-shell">
      <div className="w-full max-w-[430px] shell-surface p-7 sm:p-8">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full text-white flex items-center justify-center" style={{ background: 'linear-gradient(90deg, var(--brand-a), var(--brand-b))' }}>
            <UserCircle2 size={28} />
          </div>
          <div className="text-center">
            <h1 className="text-[49px] font-bold leading-tight">Create Account</h1>
            <p className="mt-2 text-[23px]" style={{ color: 'var(--muted-text)' }}>Please fill in the details to register</p>
          </div>
        </div>

        <form className="space-y-4 mt-8" onSubmit={handleSubmit(onSubmit, onError)}>
          <div className="grid grid-cols-[95px_1fr] items-center gap-3">
            <label className="text-[22px] font-medium">Name</label>
            <input type="text" className="form-input" placeholder="Enter your name" {...register('name')} />
          </div>
          {errors.name && <p className="text-sm text-rose-600">{errors.name.message}</p>}

          <div className="grid grid-cols-[95px_1fr] items-center gap-3">
            <label className="text-[22px] font-medium">Email</label>
            <input type="email" className="form-input" placeholder="Enter your email" {...register('email')} />
          </div>
          {errors.email && <p className="text-sm text-rose-600">{errors.email.message}</p>}

          <div className="grid grid-cols-[95px_1fr] items-center gap-3">
            <label className="text-[22px] font-medium">Password</label>
            <input type="password" className="form-input" placeholder="Enter your password" {...register('password')} />
          </div>
          {errors.password && <p className="text-sm text-rose-600">{errors.password.message}</p>}

          <div className="grid grid-cols-[95px_1fr] items-center gap-3">
            <label className="text-[22px] font-medium">Role</label>
            <select {...register('role')} className="form-input">
              <option value="Student">Student</option>
              <option value="TA">Teaching Assistant</option>
              <option value="Teacher">Teacher</option>
            </select>
          </div>

          {selectedRole === 'TA' && (
            <div className="grid grid-cols-[95px_1fr] items-center gap-3">
              <label className="text-[22px] font-medium">Teacher ID</label>
              <input type="text" className="form-input" placeholder="e.g., T0001" {...register('teacherUniqueId')} />
            </div>
          )}

          <Button type="submit" className="w-full gradient-btn h-11 rounded-[9px] text-[24px]" isLoading={isLoading}>
            Register
          </Button>
        </form>

        <div className="mt-8 text-center text-sm" style={{ color: 'var(--muted-text)' }}>
          Already have an account?{' '}
          <Link to="/login" className="underline" style={{ color: '#5f6488' }}>Login here</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;
