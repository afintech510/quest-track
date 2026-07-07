import { useState } from 'react';
import PurchaseConfirm from './PurchaseConfirm';
import { ShoppingBag } from 'lucide-react';

export default function RewardGrid({ rewards, activeKid, redeemReward }) {
  const [selectedReward, setSelectedReward] = useState(null);

  if (!rewards || rewards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ShoppingBag size={64} className="text-slate-600 mb-4" />
        <p className="font-fredoka text-xl text-slate-400 mb-2">Reward Shop is empty!</p>
        <p className="font-quicksand text-sm text-slate-500">A parent can add rewards from their phone.</p>
      </div>
    );
  }

  const handlePurchase = async () => {
    if (!selectedReward) return;
    await redeemReward(selectedReward.id);
    setSelectedReward(null);
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {rewards.map(reward => (
          <button
            key={reward.id}
            className="tv-focusable bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-amber-500/50 rounded-xl p-4 text-center transition-all"
            onClick={() => setSelectedReward(reward)}
          >
            <p className="text-3xl mb-2">{reward.icon || '🎁'}</p>
            <p className="font-fredoka text-sm text-white truncate">{reward.title}</p>
            <p className="font-quicksand text-xs text-amber-400 mt-1">{reward.cost} coins</p>
          </button>
        ))}
      </div>

      {selectedReward && (
        <PurchaseConfirm
          reward={selectedReward}
          kidCoins={activeKid?.coins || 0}
          onConfirm={handlePurchase}
          onCancel={() => setSelectedReward(null)}
        />
      )}
    </>
  );
}
