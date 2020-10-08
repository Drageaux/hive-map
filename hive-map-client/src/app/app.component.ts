import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  // inspired by credit: http://bl.ocks.org/robschmuecker/7880033
  // model
  currMessage = 'test';
  data: Message = {};

  // calculate total nodes, max label length
  totalNodes = 0;
  maxLabelLength = 0;
  // variables for drag/drop
  selectedNode = null;
  draggingNode = null;
  // panning variables
  panSpeed = 200;
  panBoundary = 20; // Within 20px from edges will pan when dragging.
  // Misc. variables
  i = 0;
  duration = 750;
  root;

  ngOnInit() {
    let tree = d3.tree().size([1000, 1000]);

    // node paths
    let diagonal = d3
      .linkHorizontal()
      .x((d) => d[0])
      .y((d) => d[1]);

    let recurVisit = (parentMessage, visitFn, childrenFn) => {
      if (!parentMessage) {
        return;
      }

      visitFn(parent);

      let children = childrenFn(parentMessage);
      if (children) {
        let count = children.length;
        for (var i = 0; i < count; i++) {
          recurVisit(children[i], visitFn, childrenFn);
        }
      }
    };

    let visit = (m: Message) => {
      this.totalNodes++;
      this.maxLabelLength = m.text
        ? Math.max(m.text.length, this.maxLabelLength)
        : this.maxLabelLength;
    };
    let getNextChildren = (m: Message) => {
      return m.children && m.children.length > 0 ? m.children : null;
    };

    // use the above functions to visit and establish maxLabelLength
    recurVisit(this.data, visit, getNextChildren);
  }

  /*************************************************************************/
  /**************************** MINDMAP CONTROLS ***************************/
  /*************************************************************************/
  sort() {}

  pan() {}

  zoom() {}
}
