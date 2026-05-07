/** Fetches the currently active puzzle from the server. */
export async function loadActivePuzzle() {
  const { active } = await fetch('/api/config').then(r => r.json());
  return fetch(`/puzzles/${active}.json`).then(r => r.json());
}
