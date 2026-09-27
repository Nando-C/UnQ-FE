// Which of a page's sections the reader is in, for a section nav that follows the
// scroll. `tops` are the sections' top edges relative to the viewport, in page order;
// `offset` is the height of the fixed header covering the top of the viewport.
//
// The current section is the last one whose top has reached the header's bottom edge
// (with a few px of slack for rounding: jumping to a section lands its top exactly on
// that edge). At the very bottom of a scrollable page the last section wins even if
// its top never gets that high, because a short final section can't be scrolled up to
// the header, and its tab would otherwise never light.
export const activeSection = (
  tops: number[],
  offset: number,
  atBottom: boolean
) => {
  if (atBottom) return tops.length - 1;
  let current = 0;
  tops.forEach((top, i) => {
    if (top - offset <= 4) current = i;
  });
  return current;
};

// Which edges of a horizontally scrollable strip have content hidden past them, so
// each can show a fade only while there is more to scroll to on that side. 1px of
// slack absorbs sub-pixel scroll positions.
export const hiddenEdges = (
  scrollLeft: number,
  scrollWidth: number,
  clientWidth: number
) => ({
  start: scrollLeft > 1,
  end: scrollLeft < scrollWidth - clientWidth - 1,
});
