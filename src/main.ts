import { mountBinder } from './app';
import { loadCollection } from './data/load-collection';
import { query } from './ui/dom';

const main = query('main');
const status = query('#load-status');
const error = query('#load-error');
const retry = query<HTMLButtonElement>('#retry');
let loading = false;

async function bootstrap(): Promise<void> {
  if (loading) return;
  loading = true;
  retry.disabled = true;
  error.hidden = true;
  status.hidden = false;
  main.setAttribute('aria-busy', 'true');
  try {
    const chapters = await loadCollection(
      `${import.meta.env.BASE_URL}collection.json`,
    );
    mountBinder(chapters);
  } catch (cause) {
    error.hidden = false;
    console.error('Unable to initialize the binder', cause);
  } finally {
    loading = false;
    retry.disabled = false;
    status.hidden = true;
    main.setAttribute('aria-busy', 'false');
  }
}

retry.addEventListener('click', () => {
  void bootstrap();
});
void bootstrap();
