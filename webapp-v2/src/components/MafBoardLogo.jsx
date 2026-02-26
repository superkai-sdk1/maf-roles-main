import React from 'react';
import { IconMafBoard } from '../utils/icons';
import { useAuth } from '../context/AuthContext';
import { FEATURES } from '../hooks/useSubscription';
import mproSvg from '../media/mpro.svg';
import muSvg from '../media/mu.svg';

export function MafBoardLogo({ size = 28, className = '' }) {
  const { isAuthenticated, subscriptions } = useAuth();

  if (!isAuthenticated || !subscriptions) {
    return <IconMafBoard size={size} color="var(--accent-color, #a855f7)" />;
  }

  const totalFeatures = Object.keys(FEATURES).length;
  const activeCount = Object.keys(subscriptions).filter(k => FEATURES[k]).length;

  if (activeCount >= totalFeatures) {
    return <img src={muSvg} alt="MafBoard Ultimate" width={size} height={size} className={className} />;
  }

  if (activeCount > 0) {
    return <img src={mproSvg} alt="MafBoard Pro" width={size} height={size} className={className} />;
  }

  return <IconMafBoard size={size} color="var(--accent-color, #a855f7)" />;
}
