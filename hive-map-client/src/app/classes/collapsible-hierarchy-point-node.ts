import { HierarchyPointNode } from 'd3';
import { Message } from '../messages/message';

export type MessageNode = HierarchyPointNode<Message> & {
  _children?;
  x0?;
  y0?;
  isCollapsed?;
};
