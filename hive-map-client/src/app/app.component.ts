import { Component, OnInit } from '@angular/core';
import { Message } from './messages/message';
import * as d3 from 'd3';
import exampleData from '../assets/mindmap-example.json';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  // inspired by: http://bl.ocks.org/robschmuecker/7880033
  // model
  currMessage = 'test';
  data: Message = exampleData;

  // d3 set up
  tree = d3.tree().size([1000, 1000]);
  diagonal = d3
    .linkHorizontal()
    .x((d) => d[0])
    .y((d) => d[1]); // node paths
  root: d3.HierarchyNode<Message> = exampleData;
  // svg-related objects
  svg;
  // append a group which holds all nodes and which the zoom Listener can act upon.
  svgGroup;

  // calculate total nodes, max label length
  totalNodes = 0;
  maxLabelLength = 0;
  // variables for drag/drop
  selectedNode = null;
  draggingNode = null;
  // panning variables
  panSpeed = 200;
  panBoundary = 20; // Within 20px from edges will pan when dragging.
  // misc. variables
  i = 0;
  duration = 750;

  ngOnInit() {
    // size of the diagram
    var viewerWidth = window.innerWidth;
    var viewerHeight = window.innerHeight;
    this.svg = d3
      .select('#hive-map')
      .attr('width', viewerWidth)
      .attr('height', viewerHeight)
      .attr('class', 'overlay');
    // .call(zoomListener);

    this.svgGroup = this.svg.append('g');

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

    this.update(this.root);
  }

  /*************************************************************************/
  /**************************** MINDMAP CONTROLS ***************************/
  /*************************************************************************/
  sort() {}

  pan() {}

  zoom() {
    // svgGroup.attr(
    //   'transform',
    //   'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')'
    // );
  }

  /*************************************************************************/
  /****************************** DATA UPDATE ******************************/
  /*************************************************************************/
  update(source: d3.HierarchyNode<Message>) {
    // Compute the new height, function counts total children of root node and sets tree height accordingly.
    // This prevents the layout looking squashed when new nodes are made visible or looking sparse when nodes are removed
    // This makes the layout more consistent.
    let levelWidth = [1];
    let childCount = function (level, n) {
      if (n.children && n.children.length > 0) {
        if (levelWidth.length <= level + 1) levelWidth.push(0);

        levelWidth[level + 1] += n.children.length;
        n.children.forEach(function (d) {
          childCount(level + 1, d);
        });
      }
    };
    childCount(0, this.currMessage);
    let newHeight = d3.max(levelWidth) * 25; // 25 pixels per line
    this.tree = this.tree.size([newHeight, window.innerWidth]);

    // Compute the new tree layout.
    const treeRoot = d3.hierarchy(this.root);
    const nodes = treeRoot.descendants();
    const links = treeRoot.links();
    console.log(treeRoot);
    console.log(nodes);
    console.log(links);

    // Set widths between levels based on maxLabelLength.
    nodes.forEach((d) => {
      // d.y = d.depth * (this.maxLabelLength * 10); //maxLabelLength * 10px
      // alternatively to keep a fixed scale one can set a fixed depth per level
      // Normalize for fixed-depth by commenting out below line
      // d.y = (d.depth * 500); //500px per level.
    });

    // Update the nodes…
    console.log(this.maxLabelLength);
    let node = this.svgGroup.selectAll('g.node').data(nodes, (d) => {
      d.y = d.depth * (this.maxLabelLength * 10); //maxLabelLength * 10px
      console.log(d);
      return d.id || (d.id = this.i++);
    });

    // console.log('node:', node);

    // Enter any new nodes at the parent's previous position.
    let nodeEnter = node
      .enter()
      .append('g')
      // .call(dragListener)
      .attr('class', 'node')
      .attr('transform', function (d) {
        return 'translate(' + window.innerHeight / 2 + ',' + 0 + ')';
      });
    // .on('click', click);

    nodeEnter
      .append('circle')
      .attr('class', 'nodeCircle')
      .attr('r', 0)
      .style('fill', (d) => {
        return d._children ? 'lightsteelblue' : '#fff';
      });

    nodeEnter
      .append('text')
      .attr('x', function (d) {
        return d.children || d._children ? -10 : 10;
      })
      .attr('dy', '.35em')
      .attr('class', 'nodeText')
      .attr('text-anchor', function (d) {
        return d.children || d._children ? 'end' : 'start';
      })
      .text(function (d) {
        return d.name;
      })
      .style('fill-opacity', 0);

    // phantom node to give us mouseover in a radius around it
    // nodeEnter
    //   .append('circle')
    //   .attr('class', 'ghostCircle')
    //   .attr('r', 30)
    //   .attr('opacity', 0.2) // change this to zero to hide the target area
    //   .style('fill', 'red')
    //   .attr('pointer-events', 'mouseover')
    //   .on('mouseover', function (node) {
    //     overCircle(node);
    //   })
    //   .on('mouseout', function (node) {
    //     outCircle(node);
    //   });

    // Update the text to reflect whether node has children or not.
    // node
    //   .select('text')
    //   .attr('x', function (d) {
    //     return d.children || d._children ? -10 : 10;
    //   })
    //   .attr('text-anchor', function (d) {
    //     return d.children || d._children ? 'end' : 'start';
    //   })
    //   .text(function (d) {
    //     return d.name;
    //   });

    // Change the circle fill depending on whether it has children and is collapsed
    // node
    //   .select('circle.nodeCircle')
    //   .attr('r', 4.5)
    //   .style('fill', function (d) {
    //     return d._children ? 'lightsteelblue' : '#fff';
    //   });

    // Transition nodes to their new position.
    // let nodeUpdate = node
    //   .transition()
    //   .duration(duration)
    //   .attr('transform', function (d) {
    //     return 'translate(' + d.y + ',' + d.x + ')';
    //   });

    // Fade the text in
    // nodeUpdate.select('text').style('fill-opacity', 1);

    // Transition exiting nodes to the parent's new position.
    // let nodeExit = node
    //   .exit()
    //   .transition()
    //   .duration(duration)
    //   .attr('transform', function (d) {
    //     return 'translate(' + source.y + ',' + source.x + ')';
    //   })
    //   .remove();

    // nodeExit.select('circle').attr('r', 0);

    // nodeExit.select('text').style('fill-opacity', 0);

    // Update the links…
    // let link = svgGroup.selectAll('path.link').data(links, function (d) {
    //   return d.target.id;
    // });

    // Enter any new links at the parent's previous position.
    // link
    //   .enter()
    //   .insert('path', 'g')
    //   .attr('class', 'link')
    //   .attr('d', function (d) {
    //     var o = {
    //       x: source.x0,
    //       y: source.y0,
    //     };
    //     return diagonal({
    //       source: o,
    //       target: o,
    //     });
    //   });

    // Transition links to their new position.
    // link.transition().duration(duration).attr('d', diagonal);

    // Transition exiting nodes to the parent's new position.
    // link
    //   .exit()
    //   .transition()
    //   .duration(duration)
    //   .attr('d', function (d) {
    //     var o = {
    //       x: source.x,
    //       y: source.y,
    //     };
    //     return diagonal({
    //       source: o,
    //       target: o,
    //     });
    //   })
    //   .remove();

    // // Stash the old positions for transition.
    // nodes.forEach(function (d) {
    //   d.x0 = d.x;
    //   d.y0 = d.y;
    // });
  }
}
