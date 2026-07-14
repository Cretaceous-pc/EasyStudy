import { useLayoutStore, useAuthStore } from '../stores';
import TopBar from '../components/layout/TopBar';
import IconBar from '../components/layout/IconBar';
import DirectoryBar from '../components/layout/DirectoryBar';
import DefaultView from '../views/DefaultView';
import CompanionView from '../views/CompanionView';
import ResourceView from '../views/ResourceView';
import LearningPathView from '../views/LearningPathView';
import ProfileView from '../views/ProfileView';
import WelcomeModal from '../components/onboarding/WelcomeModal';

export default function MainLayout() {
  const { currentFile, showDirectory, activeView } = useLayoutStore();
  const { justRegistered, clearJustRegistered } = useAuthStore();

  const renderMainContent = () => {
    switch (activeView) {
      case 'resources':
        return <ResourceView />;
      case 'path':
        return <LearningPathView />;
      case 'profile':
        return <ProfileView />;
      case 'chat':
      default:
        return currentFile ? <CompanionView /> : <DefaultView />;
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--parchment)' }}>
      <TopBar />
      <div className="flex flex-1 overflow-hidden min-h-0">
        <IconBar />
        <DirectoryBar visible={showDirectory && activeView === 'chat'} />
        <main className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {renderMainContent()}
        </main>
      </div>

      {/* 新用户注册后 — 功能介绍弹窗 */}
      <WelcomeModal
        open={justRegistered}
        onComplete={() => clearJustRegistered()}
        onSkip={() => clearJustRegistered()}
      />
    </div>
  );
}

