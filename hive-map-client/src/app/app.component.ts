import { Component, OnInit } from '@angular/core';
import { Message } from './messages/message';
import * as d3 from 'd3';
import exampleData from '../assets/mindmap-example.json';
import { DefaultLinkObject, HierarchyPointLink } from 'd3';

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
  d3tree = d3.tree<Message>().size([1000, 1000]);
  diagonal = d3
    .linkHorizontal()
    .x((d) => d[1])
    .y((d) => d[0]); // node paths
  root: d3.HierarchyPointNode<Message> = this.d3tree(d3.hierarchy(this.data));
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
  // zoom
  zoomListener;
  // panning variables
  panSpeed = 200;
  panBoundary = 20; // Within 20px from edges will pan when dragging.
  panTimer;
  // misc. variables
  i = 0;
  duration = 750;

  ngOnInit() {
    // size of the diagram
    let viewerWidth = window.innerWidth;
    let viewerHeight = window.innerHeight;
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

      visitFn(parentMessage);

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

    this.sort();
    // define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    this.zoomListener = d3
      .zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', () => {
        this.svgGroup.attr('transform', d3);
      });

    this.update(this.root);

    this.centerNode(this.root);
  }

  /*************************************************************************/
  /**************************** MINDMAP CONTROLS ***************************/
  /*************************************************************************/
  sort() {}

  pan(domNode, direction) {
    // let speed = this.panSpeed;
    // if (this.panTimer) {
    //   clearTimeout(this.panTimer);
    //   translateCoords = d3.transform(svgGroup.attr('transform'));
    //   if (direction == 'left' || direction == 'right') {
    //     translateX =
    //       direction == 'left'
    //         ? translateCoords.translate[0] + speed
    //         : translateCoords.translate[0] - speed;
    //     translateY = translateCoords.translate[1];
    //   } else if (direction == 'up' || direction == 'down') {
    //     translateX = translateCoords.translate[0];
    //     translateY =
    //       direction == 'up'
    //         ? translateCoords.translate[1] + speed
    //         : translateCoords.translate[1] - speed;
    //   }
    //   scaleX = translateCoords.scale[0];
    //   scaleY = translateCoords.scale[1];
    //   scale = zoomListener.scale();
    //   svgGroup
    //     .transition()
    //     .attr(
    //       'transform',
    //       'translate(' + translateX + ',' + translateY + ')scale(' + scale + ')'
    //     );
    //   d3.select(domNode)
    //     .select('g.node')
    //     .attr('transform', 'translate(' + translateX + ',' + translateY + ')');
    //   zoomListener.scale(zoomListener.scale());
    //   zoomListener.translate([translateX, translateY]);
    //   this.panTimer = setTimeout( () => {
    //     this.pan(domNode, direction);
    //   }, 50);
    // }
  }

  // zoom() {
  //   this.svgGroup.attr(
  //     'transform',
  //     'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')'
  //   );
  // }

  // Function to center node when clicked/dropped so node doesn't get lost when collapsing/moving with large amount of children.
  centerNode(source: d3.HierarchyPointNode<Message>) {
    console.log(d3.zoomTransform(this.svgGroup).k);
    let scale = d3.zoomTransform(this.svgGroup).k;
    let x = -source.y;
    let y = -source.x;
    x = x * scale + window.innerWidth / 2;
    y = y * scale + window.innerHeight / 2;
    this.svgGroup
      .transition()
      .duration(this.duration)
      .attr('transform', 'translate(' + x + ',' + y + ')scale(' + scale + ')');
    // .on("end", () => this.svgGroup.call(this.zoomListener.transform, d3.zoomIdentity.translate(x,y).scale(scale)));
    // this.zoomListener.scale(scale);
    // this.zoomListener.translate([x, y]);
  }

  toggleChildren(d) {
    if (d.children) {
      d._children = d.children;
      d.children = null;
    } else if (d._children) {
      d.children = d._children;
      d._children = null;
    }
    return d;
  }

  // Toggle children on click.
  click(event, d) {
    if (event.defaultPrevented) return; // click suppressed
    // d = this.toggleChildren(d);
    console.log(d);
    this.update(d);
    // this.centerNode(d);
  }

  /*************************************************************************/
  /****************************** DATA UPDATE ******************************/
  /*************************************************************************/
  update(source: d3.HierarchyPointNode<Message>) {
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
    childCount(0, source);
    let newHeight = d3.max(levelWidth) * 25; // 25 pixels per line
    console.log('new height', newHeight);
    this.d3tree = this.d3tree.size([newHeight, window.innerWidth]);

    // Compute the new tree layout.
    const treeRoot = this.d3tree(source);
    const nodes = treeRoot.descendants();
    const links = treeRoot.links();

    console.log(nodes);
    // Set widths between levels based on maxLabelLength.
    nodes.forEach((d) => {
      d.y = d.depth * (this.maxLabelLength * 10); //maxLabelLength * 10px
      // alternatively to keep a fixed scale one can set a fixed depth per level
      // Normalize for fixed-depth by commenting out below line
      // d.y = (d.depth * 500); //500px per level.
      console.log(d.y);
    });
    console.log('done');
    // Update the nodes…
    let node = this.svgGroup.selectAll('g.node').data(nodes, (d) => {
      // d.y = d.depth * (this.maxLabelLength * 10); //maxLabelLength * 10px

      console.log(d.y);
      return d.id || (d.id = this.i++);
    });

    // Enter any new nodes at the parent's previous position.
    let nodeEnter = node
      .enter()
      .append('g')
      // .call(dragListener)
      .attr('class', 'node')
      .attr('transform', (d) => {
        return 'translate(' + source.y + ',' + source.x + ')';
      })
      .on('click', (event, d) => {
        console.log(d);
        return this.click(event, d);
      });

    nodeEnter
      .append('circle')
      .attr('class', 'nodeCircle')
      .attr('r', 0)
      .style('fill', (d) => {
        return d._children ? 'lightsteelblue' : '#fff';
      })
      // Change the circle fill depending on whether it has children and is collapsed
      .merge(node)
      .attr('r', 4.5)
      .style('fill', (d) => {
        return d.children || d._children ? 'lightsteelblue' : '#fff';
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
      .text((d) => {
        return d.data.text;
      })
      .style('fill-opacity', 0)
      // Update the text to reflect whether node has children or not.
      .merge(node)
      .attr('x', function (d) {
        return d.children || d._children ? -10 : 10;
      })
      .attr('text-anchor', function (d) {
        return d.children || d._children ? 'end' : 'start';
      })
      .text((d) => {
        return d.data.text;
      });

    // phantom node to give us mouseover in a radius around it
    nodeEnter
      .append('circle')
      .attr('class', 'ghostCircle')
      .attr('r', 30)
      .attr('opacity', 0.2) // change this to zero to hide the target area
      .style('fill', 'red')
      .attr('pointer-events', 'mouseover')
      .on('mouseover', function (node) {
        // overCircle(node);
      })
      .on('mouseout', function (node) {
        // outCircle(node);
      });

    // Transition nodes to their new position.
    let nodeUpdate = node
      .merge(nodeEnter)
      .transition()
      .duration(this.duration)
      .attr('transform', (d) => {
        console.log(d);
        return 'translate(' + d.y + ',' + d.x + ')';
      });

    // Fade the text in
    nodeUpdate.select('text').style('fill-opacity', 1);

    // Transition exiting nodes to the parent's new position.
    let nodeExit = this.svgGroup
      .selectAll('g.node')
      .exit()
      .transition()
      .duration(this.duration)
      .attr('transform', (d) => {
        return 'translate(' + source.y + ',' + source.x + ')';
      })
      .remove();

    nodeExit.select('circle').attr('r', 0);

    nodeExit.select('text').style('fill-opacity', 0);

    // Update the links…
    let link = this.svgGroup.selectAll('path.link').data(links, (d) => {
      return d.target.id;
    });

    // Enter any new links at the parent's previous position.
    let linkEnter = link
      .enter()
      .append('path', 'g')
      .attr('class', 'link')
      .attr('d', (d: HierarchyPointLink<Message>) =>
        this.diagonal({
          source: [source.x, source.y],
          target: [source.x, source.y],
        })
      );

    // Transition links to their new position.
    link
      .merge(linkEnter)
      .transition()
      .duration(this.duration)
      .attr('d', (d: HierarchyPointLink<Message>) =>
        this.diagonal({
          source: [d.source.x, d.source.y],
          target: [d.target.x, d.target.y],
        })
      );

    // Transition exiting nodes to the parent's new position.
    link
      .exit()
      .transition()
      .duration(this.duration)
      .attr('d', (d: HierarchyPointLink<Message>) =>
        this.diagonal({
          source: [source.x, source.y],
          target: [source.x, source.y],
        })
      )
      .remove();

    // Stash the old positions for transition.
    nodes.forEach(function (d) {
      // d.x = source.x;
      // d.y = source.y;
    });
  }
}
