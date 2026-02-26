import React from 'react';
import { useSubscription, FEATURES, PRICE_PER_FEATURE, PRICE_ALL_FEATURES } from '../hooks/useSubscription';

export function SubscriptionGate({ feature, children, inline = false }) {
  const { hasAccess, isTrial, daysLeft } = useSubscription(feature);

  if (hasAccess) {
    return (
      <>
        {isTrial && daysLeft <= 1 && (
          <div className="subscription-trial-warning">
            Пробный период заканчивается {daysLeft === 0 ? 'сегодня' : 'завтра'}!
          </div>
        )}
        {children}
      </>
    );
  }

  if (inline) {
    return (
      <span className="subscription-gate-inline" title="Требуется подписка">
        🔒
      </span>
    );
  }

  const featureName = FEATURES[feature] || feature;

  return (
    <div className="subscription-gate">
      <div className="subscription-gate-content">
        <div className="subscription-gate-icon">🔒</div>
        <h3 className="subscription-gate-title">Раздел «{featureName}» требует подписки</h3>
        <p className="subscription-gate-text">
          Оформите подписку, чтобы получить полный доступ к этому разделу.
        </p>
        <div className="subscription-gate-pricing">
          <span>{featureName} — <strong>{PRICE_PER_FEATURE}₽/мес</strong></span>
          <div className="subscription-gate-divider">или</div>
          <span className="subscription-gate-all">
            Все разделы — <strong>{PRICE_ALL_FEATURES}₽/мес</strong>
          </span>
        </div>
        <div className="subscription-gate-actions">
          <a
            className="subscription-gate-btn primary"
            href="https://t.me/MafBoardBot?start=subscribe"
            target="_blank"
            rel="noopener noreferrer"
          >
            Оформить подписку
          </a>
          <a
            className="subscription-gate-btn secondary"
            href="https://t.me/MafBoardBot?start=trial"
            target="_blank"
            rel="noopener noreferrer"
          >
            3 дня бесплатно
          </a>
        </div>
      </div>
    </div>
  );
}
