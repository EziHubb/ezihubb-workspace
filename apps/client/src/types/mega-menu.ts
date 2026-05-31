export interface MegaMenuItem {
  name:       string;
  categoryId: string;
  slug:       string;
  sortOrder:  number;
}

export interface MegaMenuGroup {
  title:      string;
  categoryId: string;
  slug:       string;
  sortOrder:  number;
  items:      MegaMenuItem[];
}

export interface MegaMenuTab {
  navLabel:   string;
  navSlug:    string;
  categoryId: string;
  sortOrder:  number;
  isVisible:  boolean;
  groups:     MegaMenuGroup[];
}
