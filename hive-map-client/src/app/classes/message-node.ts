import { HierarchyPointNode } from 'd3';
import { Message } from '../messages/message';

export type MessageNode = HierarchyPointNode<Message> & {
  x0?;
  y0?;
};
