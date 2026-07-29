import { Navigate } from 'react-router';

export function Home() {
  // Instantly redirect to the main 3D Editor workspace. No more placeholder landing page!
  return <Navigate to="/editor" replace />;
}
