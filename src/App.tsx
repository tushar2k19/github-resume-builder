import { MotionConfig } from 'framer-motion';
import { Resume } from './components/Resume';
import { useMotionOff } from './ui/hooks';

export function App() {
  const off = useMotionOff();
  return (
    <MotionConfig reducedMotion={off ? 'always' : 'user'}>
      <Resume />
    </MotionConfig>
  );
}

export default App;
