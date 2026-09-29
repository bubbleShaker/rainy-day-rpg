export const state = {
  mode: 'loading', // title / play / dialog / cutscene / dead / ending
  quest: 0, // 0: 長老と話す, 1: かけら集め, 2: 祠へ, 3: ボス戦, 4: クリア
  shards: [false, false, false],
  items: { cocoa: 2 },
  playTime: 0,
  player: null,
  enemies: [],
  npcs: [],
  weather: null,
  lowSpec: false,
  onPlayerDeath: null,
  onEnemyKilled: null,
  onPickup: null,
};

export const shardCount = () => state.shards.filter(Boolean).length;

export function resetProgress() {
  state.quest = 0;
  state.shards = [false, false, false];
  state.items = { cocoa: 2 };
  state.playTime = 0;
}
