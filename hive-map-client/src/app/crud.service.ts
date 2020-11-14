import { Injectable } from '@angular/core';
import exampleData from '../assets/mindmap-example.json';
import { MessageNode } from './classes/collapsible-hierarchy-point-node';
import { Message } from './messages/message';

@Injectable({
  providedIn: 'root',
})
export class CrudService {
  data: Message = exampleData[2];

  // calculate total nodes, max label length
  totalNodes = 0;
  maxLabelLength = 0;

  constructor() {
    // use the above functions to visit and establish maxLabelLength
    let visit = (m: Message) => {
      this.totalNodes++;
      this.maxLabelLength = m.text
        ? Math.max(m.text.length, this.maxLabelLength)
        : this.maxLabelLength;
    };

    // use the above functions to visit and establish maxLabelLength
    this.recurVisit(this.data, visit);
  }

  /*************************************************************************/
  /***************************** TREE FUNCTIONS ****************************/
  /*************************************************************************/
  traverse(startNode) {
    this.recurVisit(startNode, (m) => {});
  }

  recurVisit(parentMessage: Message, visitFn) {
    let childrenFn = this.getNextChildren;

    if (!parentMessage) {
      return;
    }

    visitFn(parentMessage);

    let children = childrenFn(parentMessage);
    if (children) {
      let count = children.length;
      for (let i = 0; i < count; i++) {
        this.recurVisit(children[i], visitFn);
      }
    }
  }

  getNextChildren(m: Message) {
    return m.children && m.children.length > 0 ? m.children : null;
  }

  /*************************************************************************/
  /********************************** CRUD *********************************/
  /*************************************************************************/
  generateUUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        var r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3) | 0x8).toString(16);
      }
    );
    return uuid;
  }

  addChild(node: MessageNode, text: string) {
    if (!node) return null;
    const message: Message = {
      id: this.generateUUID(),
      name: 'Current User',
      text,
      timestamp: new Date().toISOString(),
    };

    this.recurVisit(this.data, (m: Message) => {
      if (m.id === node.data.id) {
        m.children && !m._children ? m.children.push(message) : null;
        m._children && !m.children ? m._children.push(message) : null;
        !m._children && !m.children ? (m.children = [message]) : null;
      }
    });

    return message;
  }

  dragChild(oldParent: MessageNode, targetParent: MessageNode, d: MessageNode) {
    // these 3 nodes must be different to make udpates
    if (
      oldParent.data.id === targetParent.data.id ||
      oldParent.data.id === d.data.id ||
      targetParent.data.id === d.data.id
    ) {
      return;
    }
    let oldParentData: Message = null;
    let newParentData: Message = null;
    let nodeData: Message = null;

    this.recurVisit(this.data, (m) => {
      if (m.id === oldParent.data.id) {
        oldParentData = oldParent.data;
      } else if (m.id === targetParent.data.id) {
        newParentData = targetParent.data;
      } else if (m.id === d.data.id) {
        nodeData = d.data;
      }
    });

    // search index by ID
    let index = oldParentData.children.map((e) => e.id).indexOf(nodeData.id);

    // now remove the element from the parent
    if (index > -1) {
      oldParentData.children.splice(index, 1);
    }
    // insert it into the new elements children
    if (!newParentData.children || newParentData.children.length === 0) {
      newParentData.children = [nodeData];
    } else {
      newParentData.children.push(nodeData);
    }
  }
}
