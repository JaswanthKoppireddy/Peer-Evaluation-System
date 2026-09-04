import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface SocketContextType {
  socket: Socket | null;
}

const SocketContext = createContext<SocketContextType>({ socket: null });

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Only connect if user is logged in
    if (!user) return;

    const newSocket = io('http://localhost:5000', {
      withCredentials: true,
    });

    newSocket.on('connect', () => {
      console.log('Connected to socket server');
      if (user.role === 'TA') {
        newSocket.emit('join_ta_room');
      } else if (user.role === 'Teacher') {
        newSocket.emit('join_teacher_room');
      }
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
