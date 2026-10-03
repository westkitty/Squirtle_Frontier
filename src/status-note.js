// A status line that can say something transiently without eating what it interrupted.
//
// Renderer adaptation reports itself through the same single status line the game uses to
// tell the player where they are and what just happened. Writing the scale notice straight
// in meant the boot sentence - "Follow the shore. The stone doorway leads to the Listening
// Basin." - survived about one second before a number about pixels replaced it. The notice
// is worth saying; it is not worth being the last thing said.
export const STATUS_FLASH_SECONDS = 3.5;
// How long a flash may run before it gives the line back. A bound rather than a frame
// count, so a hitched or backgrounded tab still returns the caption promptly.
export const STATUS_FLASH_MAX_SECONDS = 12;

// Claims the line: the returned token is what `settleStatus` needs to give it back.
//
// `running` is the flash already on the line, if any. A second flinch must not adopt the
// first one's notice as the text to restore - adaptation flinches several times in a row
// on a slow machine, and nesting them left the caption permanently reading "Render scale
// 85%." with no way back to what the game had actually said.
export function flashStatus(
  element,
  text,
  running = null,
  seconds = STATUS_FLASH_SECONDS,
) {
  // If something more important spoke while a flash was active, adaptation has lost the
  // line. A later scale change must not barge back in over that newer message.
  if (running && element.textContent !== running.wrote) return running;
  const bounded = Math.max(0.5, Math.min(STATUS_FLASH_MAX_SECONDS, seconds));
  const restore = running ? running.restore : element.textContent;
  element.textContent = text;
  return { wrote: text, restore, remaining: bounded };
}

// Returns the flash that is still running, or null once the line has been handed back.
// A flash never overwrites a message someone else wrote while it was standing in.
export function settleStatus(element, flash, dt) {
  if (!flash) return null;
  const remaining = flash.remaining - (Number.isFinite(dt) && dt > 0 ? dt : 0);
  if (remaining > 0) {
    flash.remaining = remaining;
    return flash;
  }
  if (element.textContent === flash.wrote) element.textContent = flash.restore;
  return null;
}
