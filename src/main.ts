import './cloud.css';
import './workspace.css';
import { startWorkspace } from './ui/workspace';
import { initPwa } from './pwa';
import { initMobileKeyboard } from './ui/mobile-keyboard';

if (/^#(?:greninja|kapitel(?:-\d+)?)$/.test(location.hash)) {
  location.replace(new URL(`archive.html${location.hash}`, location.href));
} else {
  initPwa();
  initMobileKeyboard();
  void startWorkspace();
}
