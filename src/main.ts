import './workspace.css';
import { startWorkspace } from './ui/workspace';

if (/^#(?:greninja|kapitel(?:-\d+)?)$/.test(location.hash)) {
  location.replace(new URL(`archive.html${location.hash}`, location.href));
} else {
  void startWorkspace();
}
