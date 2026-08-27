import React from 'react';
import { Link } from 'react-router-dom';
import { Lock, ArrowLeft } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';

interface TeamsAccessDeniedProps {
  requiredPermission?: string;
  moduleName?: string;
}

export const TeamsAccessDenied: React.FC<TeamsAccessDeniedProps> = ({ requiredPermission, moduleName }) => {
  const { user } = useAuth();

  return (
    <div className="text-center py-12 px-4 bg-white dark:bg-[#0A0A0A] rounded-xl border border-surface-border dark:border-surface-dark-border flex flex-col items-center justify-center max-w-md mx-auto my-8">
      <div className="w-12 h-12 bg-amber-500/10 text-brand-500 rounded-full flex items-center justify-center mb-4">
        <Lock className="w-5 h-5" />
      </div>
      <h2 className="text-base font-bold text-gray-900 dark:text-white mb-1">
        Access Restricted
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 max-w-xs leading-relaxed">
        Your assigned role (<strong className="text-gray-900 dark:text-white">{user?.team_role_label || 'Team Member'}</strong>) does not have access to {moduleName ? `the ${moduleName} module` : 'this page'}.
      </p>

      {requiredPermission && (
        <p className="text-xs text-gray-400 font-mono mb-4">
          Required: {requiredPermission}
        </p>
      )}

      <Link to="/teams-dashboard">
        <Button variant="default" size="sm">
          <ArrowLeft className="w-4 h-4 mr-1.5" />
          Back to Teams Dashboard
        </Button>
      </Link>
    </div>
  );
};

export default TeamsAccessDenied;
