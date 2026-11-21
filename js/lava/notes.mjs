// The render model behind the "Wat LAVA begrijpt" window.
//
// LAVA rewrites his understanding as the conversation sharpens, so an update
// REPLACES the field it carries and leaves the others alone. A field he omits
// is one he had nothing new to say about — blanking the panel there would make
// the visitor feel the agent had forgotten what they just said.
//
// Pure: no DOM, no network. The browser entry and the tests import this same
// module.

function usable(value) {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function createNotesModel() {
  const state = { understood: '', open: '' };

  return {
    apply(update) {
      if (!update || typeof update !== 'object') return;
      const understood = usable(update.understood);
      const open = usable(update.open);
      if (understood !== undefined) state.understood = understood;
      if (open !== undefined) state.open = open;
    },
    render() {
      return {
        understood: state.understood,
        open: state.open,
        hasContent: state.understood !== '' || state.open !== '',
      };
    },
  };
}
