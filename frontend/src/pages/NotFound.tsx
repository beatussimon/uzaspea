import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { EmptyState } from '../components/ui/EmptyState';
import { useTranslation } from 'react-i18next';

const NotFound: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="container-page py-20">
      <EmptyState
        icon={ShieldAlert}
        title="404 - Page Not Found"
        description={t('page_not_found_desc', 'The page you are looking for does not exist, has been removed, or is temporarily unavailable.')}
        action={{
          label: t('go_back_home', 'Go back home'),
          onClick: () => navigate('/'),
        }}
      />
    </div>
  );
};

export default NotFound;
