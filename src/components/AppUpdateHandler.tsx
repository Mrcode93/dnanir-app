import React, { useEffect, useState } from 'react';
import { InteractionManager } from 'react-native';
import { updateService, type AppUpdate } from '../services/updateService';
import { UpdateNotificationModal } from './UpdateNotificationModal';

export const AppUpdateHandler: React.FC = () => {
  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkUpdates = async () => {
      try {
        const shouldCheck = await updateService.shouldCheckForUpdate();
        
        if (shouldCheck) {
          const latestUpdate = await updateService.checkForUpdate();
          
          if (latestUpdate) {
            setUpdate(latestUpdate);
            setVisible(true);
          }
          
          // Mark as checked for today even if no update found
          await updateService.markChecked();
        }
      } catch (error) {
        
      }
    };

    const task = InteractionManager.runAfterInteractions(() => {
      checkUpdates();
    });

    return () => task.cancel();
  }, []);

  return (
    <UpdateNotificationModal
      visible={visible}
      update={update}
      onClose={() => setVisible(false)}
    />
  );
};
