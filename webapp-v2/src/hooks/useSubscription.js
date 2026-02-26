import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';

export const FEATURES = {
  gomafia: 'GoMafia',
  funky: 'Фанки',
  city_mafia: 'Городская мафия',
  minicaps: 'Миникапы',
  club_rating: 'Клубный рейтинг',
};

export const PRICE_PER_FEATURE = 299;
export const PRICE_ALL_FEATURES = 990;

export function useSubscription(featureSlug) {
  const { subscriptions, isAuthenticated } = useAuth();
  return useMemo(() => {
    if (!isAuthenticated || !subscriptions) {
      return { hasAccess: false, isTrial: false, daysLeft: 0, expiresAt: null };
    }
    const info = subscriptions[featureSlug];
    if (!info) return { hasAccess: false, isTrial: false, daysLeft: 0, expiresAt: null };
    return {
      hasAccess: true,
      isTrial: info.is_trial || false,
      daysLeft: info.days_left || 0,
      expiresAt: info.expires_at || null,
    };
  }, [subscriptions, featureSlug, isAuthenticated]);
}

export function useHasAnySubscription() {
  const { subscriptions } = useAuth();
  return useMemo(() => {
    return subscriptions && Object.keys(subscriptions).length > 0;
  }, [subscriptions]);
}

export function useAllSubscriptions() {
  const { subscriptions, isAuthenticated } = useAuth();
  return useMemo(() => {
    const result = {};
    for (const [slug, name] of Object.entries(FEATURES)) {
      const info = (subscriptions || {})[slug];
      result[slug] = {
        name,
        hasAccess: !!info,
        isTrial: info ? (info.is_trial || false) : false,
        daysLeft: info ? (info.days_left || 0) : 0,
        expiresAt: info ? (info.expires_at || null) : null,
      };
    }
    result._authenticated = isAuthenticated;
    result._totalActive = Object.values(result).filter(v => v.hasAccess).length;
    result._totalFeatures = Object.keys(FEATURES).length;
    result._hasAll = result._totalActive >= result._totalFeatures;
    result._hasAny = result._totalActive > 0;
    return result;
  }, [subscriptions, isAuthenticated]);
}
