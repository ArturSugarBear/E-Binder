import './cloud.css';
import './workspace.css';
import { startWorkspace } from './ui/workspace';
import { initPwa } from './pwa';
import { initMobileKeyboard } from './ui/mobile-keyboard';
import { initCollectorMaterial } from './ui/collector-polish';

if (/^#(?:greninja|kapitel(?:-\d+)?)$/.test(location.hash)) {
  location.replace(new URL(`archive.html${location.hash}`, location.href));
} else {
  initPwa();
  initMobileKeyboard();
  initCollectorMaterial();
  void startWorkspace();
}
