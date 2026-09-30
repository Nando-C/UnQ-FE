import placeholder from "../assets/placeholder.svg";

// The cover the BE gives a shop that hasn't uploaded one (UnQ-BE's shop model).
export const BE_DEFAULT_COVER =
  "https://nayemdevs.com/wp-content/uploads/2020/03/default-product-image.png";

// The shop's own cover (one its manager uploaded), or "" when it has none:
// the BE's stock default and the FE's placeholder don't count.
export const ownCover = (cover: string | undefined): string =>
  !cover || cover === BE_DEFAULT_COVER || cover === placeholder ? "" : cover;
