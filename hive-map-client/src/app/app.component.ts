import { Component, OnInit } from '@angular/core';
import { Message } from './messages/message';
import * as d3 from 'd3';
import exampleData from '../assets/mindmap-example.json';
import { HierarchyPointLink } from 'd3';

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
  // zoom
  zoomListener;
  // drag
  dragListener;
  // variables for drag/drop
  selectedNode = null;
  draggingNode = null;
  dragStarted = false;

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

    // Define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    this.zoomListener = d3
      .zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', ({ transform }) => {
        this.svgGroup.attr('transform', transform);
      });
    this.svg.call(this.zoomListener);

    // Define the dragListener for drag/drop behaviour of nodes.
    this.dragListener = d3
      .drag()
      .on('start', (d) => {
        console.log(d);
        // TODO: move root
        if (d === this.root) {
          return;
        }
        this.dragStarted = true;
      })
      .on('drag', () => {})
      .on('end', () => {});

    (this.root as any).x0 = viewerHeight / 2;
    (this.root as any).y0 = 0;

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
    //   let translateCoords = d3.transform(this.svgGroup.attr('transform'));
    //   if (direction == 'left' || direction == 'right') {
    //     let translateX =
    //       direction == 'left'
    //         ? translateCoords.translate[0] + speed
    //         : translateCoords.translate[0] - speed;
    //     let translateY = translateCoords.translate[1];
    //   } else if (direction == 'up' || direction == 'down') {
    //     let translateX = translateCoords.translate[0];
    //     let translateY =
    //       direction == 'up'
    //         ? translateCoords.translate[1] + speed
    //         : translateCoords.translate[1] - speed;
    //   }
    //   let scaleX = translateCoords.scale[0];
    //   let scaleY = translateCoords.scale[1];
    //   let scale = d3.zoomTransform(this.svgGroup).k;
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
    //   this.panTimer = setTimeout(() => {
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
    console.log('zoom level:', d3.zoomTransform(this.svg).k);
    let scale = d3.zoomTransform(this.svg).k;
    let x = -source.y;
    let y = -source.x;
    x = x * scale + window.innerWidth / 2;
    y = y * scale + window.innerHeight / 2;
    this.svgGroup
      .transition()
      .duration(this.duration)
      .attr('transform', 'translate(' + x + ',' + y + ')scale(' + scale + ')')
      .on('end', () =>
        this.svg.call(
          this.zoomListener.transform,
          d3.zoomIdentity.translate(x, y).scale(scale)
        )
      );
    // this.zoomListener.scale(scale);
    // this.zoomListener.translate([x, y]);
  }

  /*************************************************************************/
  /**************************** HELPER FUNCTIONS ***************************/
  /*************************************************************************/
  collapse(d) {
    if (d.children) {
      d._children = d.children;
      d._children.forEach(this.collapse);
      d.children = null;
    }
  }

  expand(d) {
    if (d._children) {
      d.children = d._children;
      d.children.forEach(this.expand);
      d._children = null;
    }
  }

  toggleChildren(d) {
    console.log(d);
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
    d = this.toggleChildren(d);
    this.update(d);
    console.log('clicked', d.data.id);
    this.centerNode(d);
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
    childCount(0, this.root);
    let newHeight = d3.max(levelWidth) * 25; // 25 pixels per line
    this.d3tree = this.d3tree
      .size([newHeight, window.innerWidth])
      .nodeSize([50, 200])
      .separation((a, b) => (a.parent == b.parent ? 1 : 1.25));

    // Compute the new tree layout.
    const treeRoot = this.d3tree(this.root);
    const nodes = treeRoot.descendants();
    const links = treeRoot.links();

    // Set widths between levels based on maxLabelLength.
    nodes.forEach((d) => {
      d.y = d.depth * (this.maxLabelLength * 10); //maxLabelLength * 10px
      // alternatively to keep a fixed scale one can set a fixed depth per level
      // Normalize for fixed-depth by commenting out below line
      // d.y = d.depth * 500; //500px per level.
      return d.data.id || (d.data.id = this.i++);
    });
    // Update the nodes…
    let node = this.svgGroup
      .selectAll('g.node')
      .data(nodes, (d) => {
        // d.y = d.depth * (this.maxLabelLength * 10); //maxLabelLength * 10px
        return d.data.id || (d.data.id = this.i++);
      })
      .join(
        (enter) =>
          // node enter
          enter
            .append('g')
            .attr('class', 'node')
            .attr('transform', (d) => {
              return (
                'translate(' +
                ((source as any).y0 || source.y) +
                ',' +
                ((source as any).x0 || source.x) +
                ')'
              );
            })
            // rect enter
            .call((g) =>
              g
                .append('rect')
                .attr('y', -20)
                .attr('x', 0)
                .attr('width', 200)
                .attr('height', 40)
                .style('fill-opacity', 0)
                .style('fill', '#5396ff')
                .style('rx', 15)
            )
            // circle enter
            .call((g) =>
              g
                .append('circle')
                .attr('class', 'nodeCircle')
                .attr('r', 0)
                .style('fill', (d) => {
                  return d._children ? 'lightsteelblue' : '#fff';
                })
            )
            // text enter
            .call((g) => g.append('text')),
        // node update
        (update) =>
          update.call((g) =>
            g
              .select('rect')
              .transition()
              .duration(this.duration)
              .style('fill-opacity', 1)
          ),
        (exit) =>
          exit
            .call((g) =>
              // Transition exiting nodes to the parent's new position.
              g
                .transition()
                .duration(this.duration)
                .attr('transform', function (d) {
                  return 'translate(' + source.y + ',' + source.x + ')';
                })
                .remove()
            )
            .call((g) =>
              g
                .select('rect')
                .transition()
                .duration(this.duration)
                .style('fill-opacity', 0)
            )
            .call((g) => g.select('circle').attr('r', 0))
            .call((g) =>
              g
                .select('text')
                .transition()
                .duration(this.duration)
                .style('fill-opacity', 0)
            )
      )
      .on('click', (event, d) => {
        return this.click(event, d);
      })
      .call(this.dragListener);
    // .on('dblclick', (event) => {
    //   event.preventDefault();
    //   console.log(event);
    // });

    //

    // Change the circle fill depending on whether it has children and is collapsed
    // node
    //   .join()
    //   .select('circle.nodeCircle')
    //   .style('r', (d) => 4.5)
    //   .style('fill', (d) => {
    //     return d._children ? 'lightsteelblue' : '#fff';
    //   });

    // Transition nodes to their new position.
    node
      .join()
      .transition()
      .duration(this.duration)
      .attr('transform', (d) => {
        return 'translate(' + d.y + ',' + d.x + ')';
      });

    node.join().select('rect').style('fill-opacity', 1);

    // Update the text to reflect whether node has children or not.
    node
      .join()
      .select('text')
      .attr('x', (d) => {
        // return d.children || d._children ? -10 : 10;
        return 50;
      })
      .attr('dy', '.35em')
      .attr('class', 'nodeText')
      .attr('text-anchor', (d) => {
        // return d.children || d._children ? 'end' : 'start';
      })
      .attr('fill', 'white')
      .text((d) => {
        return d.data.text;
      })
      // Fade the text in
      .transition()
      .duration(this.duration)
      .style('fill-opacity', 1);

    // // Fade the text in
    // node
    //   .join()
    //   .select('text')
    //   .transition()
    //   .duration(this.duration)
    //   .style('fill-opacity', 1);

    // // phantom node to give us mouseover in a radius around it
    // nodeEnter
    //   .append('circle')
    //   .merge(node)
    //   .attr('class', 'ghostCircle')
    //   .attr('r', 30)
    //   .attr('opacity', 0.2) // change this to zero to hide the target area
    //   .style('fill', 'red')
    //   .attr('pointer-events', 'mouseover')
    //   .on('mouseover', function (node) {
    //     // overCircle(node);
    //   })
    //   .on('mouseout', function (node) {
    //     // outCircle(node);
    //   });

    // Update the links…
    let link = this.svgGroup.selectAll('path.link').data(links, (d) => {
      return d.target.data.id;
    });

    // Enter any new links at the parent's previous position.
    let linkEnter = link
      .enter()
      .insert('path', 'g')
      .attr('class', 'link')
      .attr('d', (d: HierarchyPointLink<Message>) => {
        var o = {
          x: (source as any).x0,
          y: (source as any).y0,
        };
        return this.diagonal({
          source: [o.x, o.y],
          target: [o.x, o.y],
        });
      });

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
      .attr('d', (d: HierarchyPointLink<Message>) => {
        var o = {
          x: source.x,
          y: source.y,
        };
        return this.diagonal({
          source: [o.x, o.y],
          target: [o.x, o.y],
        });
      })
      .remove();

    // Stash the old positions for transition.
    nodes.forEach(function (d) {
      (d as any).x0 = d.x;
      (d as any).y0 = d.y;
    });
  }
}
