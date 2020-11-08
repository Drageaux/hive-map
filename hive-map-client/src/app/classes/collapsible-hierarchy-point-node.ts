import { HierarchyPointNode } from 'd3';
import { Message } from '../messages/message';

export type CollapsibleHierarchyPointNode<G> = HierarchyPointNode<G> & {
  _children?;
  x0?;
  y0?;
};
