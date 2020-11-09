import { Component, OnInit } from '@angular/core';
import { Message } from './messages/message';
import * as d3 from 'd3';
import {
  select,
  HierarchyPointLink,
  D3DragEvent,
  HierarchyPointNode,
  ValueFn,
} from 'd3';
import { CollapsibleHierarchyPointNode } from './classes/collapsible-hierarchy-point-node';
import { CrudService } from './crud.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  // inspired by: http://bl.ocks.org/robschmuecker/7880033
  // model
  currMessage = 'test';

  // d3 set up
  d3tree = d3.tree<Message>().size([1000, 1000]);
  diagonal = d3
    .linkHorizontal()
    .x((d) => d[1])
    .y((d) => d[0]); // node paths
  root: CollapsibleHierarchyPointNode<Message>;
  // svg-related objects
  svg: d3.Selection<SVGSVGElement, {}, HTMLElement, any>;
  // append a group which holds all nodes and which the zoom Listener can act upon.
  svgGroup: d3.Selection<SVGGElement, {}, HTMLElement, any>;

  // zoom
  zoomListener;
  // drag
  dragListener;
  // variables for drag/drop
  selectedNode = null;
  dragStarted = false;
  relCoords;

  // panning variables
  panSpeed = 200;
  panBoundary = 20; // Within 20px from edges will pan when dragging.
  panTimer;
  // misc. variables
  i = 0;
  duration = 750;

  constructor(private crudService: CrudService) {
    this.root = this.d3tree(d3.hierarchy(this.crudService.data));
  }

  ngOnInit() {
    // size of the diagram
    let viewerWidth = window.innerWidth;
    let viewerHeight = window.innerHeight;
    this.svg = d3
      .select<SVGSVGElement, {}>('#hive-map')
      .attr('width', viewerWidth)
      .attr('height', viewerHeight)
      .attr('class', 'overlay');

    this.svgGroup = this.svg.append('g');

    // this.sort();

    // Define the zoomListener which calls the zoom function on the "zoom" event constrained within the scaleExtents
    this.zoomListener = d3
      .zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', ({ transform }) => {
        this.svgGroup.attr('transform', transform);
      });
    this.svg.call(this.zoomListener);

    // Define the dragListener for drag/drop behaviour of nodes.
    this.defineDragListener();

    // Initiate root
    this.root.x0 = viewerHeight / 2;
    this.root.y0 = 0;
    this.update(this.root);
    this.centerNode(this.root);
  }

  defineDragListener() {
    let onStart = (
      g: SVGGElement,
      event: D3DragEvent<
        SVGGElement,
        CollapsibleHierarchyPointNode<Message>,
        CollapsibleHierarchyPointNode<Message>
      >,
      d: CollapsibleHierarchyPointNode<Message>
    ): void => {
      console.log(event);
      // if (Math.abs(event.dx) < 5 || Math.abs(event.dy)) {
      //   return;
      // }
      if (d === this.root) {
        // TODO: move root
        return;
      }
      this.dragStarted = true;
      console.log(d);
      // let nodes = tree.nodes(d);
      // NOTE: important, suppress the mouseover event on the node being dragged.
      // Otherwise it will absorb the mouseover event and the underlying node will not detect it
      event.sourceEvent.stopPropagation();
    };
    let onDrag = (
      g: SVGGElement,
      event: D3DragEvent<
        SVGGElement,
        CollapsibleHierarchyPointNode<Message>,
        CollapsibleHierarchyPointNode<Message>
      >,
      d: CollapsibleHierarchyPointNode<Message>
    ) => {
      if (d === this.root) {
        // TODO: move root
        return;
      }
      if (this.dragStarted) {
        this.initiateDrag(d, g);
      }

      // TODO: get coords of mouseEvent relative to svg container to allow for panning
      // relCoords = event.pageX

      d.x0 += event.dy;
      d.y0 += event.dx;
      select(g).attr('transform', 'translate(' + d.y0 + ',' + d.x0 + ')');

      this.updateTempConnector(d);
    };
    let onEnd = (
      g: SVGGElement,
      event: D3DragEvent<
        SVGGElement,
        CollapsibleHierarchyPointNode<Message>,
        CollapsibleHierarchyPointNode<Message>
      >,
      d: CollapsibleHierarchyPointNode<Message>
    ) => {
      if (d === this.root) {
        return;
      }

      if (this.selectedNode) {
        // TODO: all in service
        this.crudService.dragChild(d.parent, this.selectedNode, d);

        // // now remove the element from the parent
        // let index = d.parent.children.indexOf(d);
        // console.log("parent's children", d.parent.children);
        // console.log('index of node in parent list', index);
        // if (index > -1) {
        //   d.parent.children.splice(index, 1);
        // }
        // // insert it into the new elements children
        // console.log('targetNode:', this.selectedNode);

        // if (
        //   typeof this.selectedNode.children !== 'undefined' ||
        //   typeof this.selectedNode._children !== 'undefined'
        // ) {
        //   console.log('has children');
        //   if (typeof this.selectedNode.children !== 'undefined') {
        //     this.selectedNode.children.push(d);
        //   } else {
        //     this.selectedNode._children.push(d);
        //   }
        // } else {
        //   console.log('no children');
        //   this.selectedNode.children = [];
        //   this.selectedNode.children.push(d);
        //   console.log('now with children', this.selectedNode);
        // }
        // Update data source
        d.parent = this.selectedNode;

        // Make sure that the node being added to is expanded so user can see added node is correctly moved
        this.expand(this.selectedNode);
        this.sort();
        this.endDrag(d, g);
      } else {
        this.endDrag(d, g);
      }
    };

    this.dragListener = d3
      .drag<SVGGElement, CollapsibleHierarchyPointNode<Message>>()
      .on('start', function (event, d) {
        return onStart(this, event, d);
      })
      .on('drag', function (event, d) {
        return onDrag(this, event, d);
      })
      .on('end', function (event, d) {
        return onEnd(this, event, d);
      });
  }

  /*************************************************************************/
  /**************************** MINDMAP CONTROLS ***************************/
  /*************************************************************************/
  initiateDrag(
    datum: CollapsibleHierarchyPointNode<Message>,
    domNode: SVGGElement
  ) {
    d3.select(domNode).select('.ghostCircle').attr('pointer-events', 'none');
    d3.selectAll('.ghostCircle').attr('class', 'ghostCircle show');
    d3.select(domNode).attr('class', 'node activeDrag');

    this.svgGroup
      .selectAll<SVGGElement, CollapsibleHierarchyPointNode<Message>>('g.node')
      .sort((a, b) => {
        // select the parent and sort the path's
        if (a.data.id != datum.data.id) return 1;
        // a is not the hovered element, send "a" to the back
        else return -1; // a is the hovered element, bring "a" to the front
      });
    // if nodes has children, remove the links and nodes
    let nodes = datum.descendants();
    let tree = this.d3tree(datum);
    if (nodes.length > 1) {
      // remove link paths
      let links = tree.links();
      let nodePaths = this.svgGroup
        .selectAll<SVGPathElement, {}>('path.link')
        .data(links, (d: HierarchyPointLink<Message>) => d.target.data.id)
        .remove();
      // remove child nodes
      let nodesExit = this.svgGroup
        .selectAll('g.node')
        .data<CollapsibleHierarchyPointNode<Message>>(
          nodes,
          (d: CollapsibleHierarchyPointNode<Message>) => d.data.id
        )
        .filter((d, i) => {
          if (d.data.id == datum.data.id) {
            return false;
          }
          return true;
        })
        .remove();
    }

    // remove parent link
    let parentNode = datum.parent;
    let parentLink = parentNode.links();
    this.svgGroup
      .selectAll<SVGPathElement, {}>('path.link')
      .filter((t: HierarchyPointLink<Message>, i) => {
        if (t.target.data.id == datum.data.id) {
          return true;
        }
        return false;
      })
      .remove();

    this.dragStarted = null;
  }

  endDrag(d: CollapsibleHierarchyPointNode<Message>, g: SVGGElement) {
    this.selectedNode = null;
    d3.selectAll('.ghostCircle').attr('class', 'ghostCircle');
    d3.select(g).attr('class', 'node');
    // now restore the mouseover event or we won't be able to drag a 2nd time
    d3.select(g).select('.ghostCircle').attr('pointer-events', '');
    this.updateTempConnector(d);
    if (d !== null) {
      this.update(this.root);
      this.centerNode(d);
    }
  }

  sort() {
    this.root.sort(function (a, b) {
      return b.data.text.toLowerCase() < a.data.text.toLowerCase() ? 1 : -1;
    });
  }

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
  centerNode(source: CollapsibleHierarchyPointNode<Message>) {
    // console.log('zoom level:', d3.zoomTransform(this.svg.node()).k);
    let scale = d3.zoomTransform(this.svg.node()).k;
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
  collapse(d: CollapsibleHierarchyPointNode<Message>) {
    d.isCollapsed = true;
    // if (d.children) {
    //   d.collapsed
    //   d._children = d.children;
    //   d._children.forEach(this.collapse);
    //   d.children = null;
    // }
  }

  expand(d: CollapsibleHierarchyPointNode<Message>) {
    if (d._children) {
      d.children = d._children;
      d.children.forEach(this.expand);
      d._children = null;
    }
  }

  toggleChildren(d: CollapsibleHierarchyPointNode<Message>) {
    // if (d.children) {
    //   d._children = d.children;
    //   d.children = null;
    // } else if (d._children) {
    //   d.children = d._children;
    //   d._children = null;
    // }
    d.isCollapsed = !d.isCollapsed;
    return d;
  }

  // Toggle children on click.
  click(event, d) {
    if (event.defaultPrevented) return; // click suppressed
    d = this.toggleChildren(d);
    this.update(d);
    this.centerNode(d);
  }

  overCircle(d: CollapsibleHierarchyPointNode<Message>) {
    this.selectedNode = d;
    this.updateTempConnector(d);
  }
  outCircle(d: CollapsibleHierarchyPointNode<Message>) {
    this.selectedNode = null;
    this.updateTempConnector(d);
  }

  // Function to update the temporary connector indicating dragging affiliation
  updateTempConnector(d: CollapsibleHierarchyPointNode<Message>) {
    var data = [];
    if (d !== null && this.selectedNode !== null) {
      // have to flip the source coordinates since we did this for the existing connectors on the original tree
      data = [
        {
          source: d,
          target: this.selectedNode,
        },
      ];
    }
    let tempLink = this.svgGroup
      .selectAll<SVGPathElement, {}>('path.templink')
      .data(data, (d: HierarchyPointLink<Message>) => {
        return d.target.data.id;
      });

    tempLink
      .enter()
      .append('path')
      .attr('class', 'templink')
      .attr('d', (d: HierarchyPointLink<Message>) => {
        return this.diagonal({
          source: [
            (d.source as CollapsibleHierarchyPointNode<Message>).x0,
            (d.source as CollapsibleHierarchyPointNode<Message>).y0,
          ],
          target: [d.target.x, d.target.y],
        });
      })
      .attr('pointer-events', 'none');

    tempLink.attr('d', (d: HierarchyPointLink<Message>) => {
      return this.diagonal({
        source: [
          (d.source as CollapsibleHierarchyPointNode<Message>).x0,
          (d.source as CollapsibleHierarchyPointNode<Message>).y0,
        ],
        target: [d.target.x, d.target.y],
      });
    });

    tempLink.exit().remove();
  }

  /*************************************************************************/
  /****************************** DATA UPDATE ******************************/
  /*************************************************************************/
  update(source: CollapsibleHierarchyPointNode<Message>) {
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
    childCount(0, this.crudService.data);
    let newHeight = d3.max(levelWidth) * 25; // 25 pixels per line
    this.d3tree = this.d3tree
      .size([newHeight, window.innerWidth])
      .nodeSize([50, 200])
      .separation((a, b) => (a.parent == b.parent ? 1 : 1.25));

    // Compute the new tree layout.
    this.root = this.d3tree(d3.hierarchy(this.crudService.data));
    this.root.x0 = window.innerHeight / 2;
    this.root.y0 = 0;
    const nodes: CollapsibleHierarchyPointNode<
      Message
    >[] = this.root.descendants();
    const links = this.root.links();

    // Set widths between levels based on maxLabelLength.
    nodes.forEach((d) => {
      d.y = d.depth * (this.crudService.maxLabelLength * 10); //maxLabelLength * 10px
      d.isCollapsed = false;
      // alternatively to keep a fixed scale one can set a fixed depth per level
      // Normalize for fixed-depth by commenting out below line
      // d.y = d.depth * 500; //500px per level.
      return d.data.id || (d.data.id = this.i++);
    });
    // Update the nodes…
    let node = this.svgGroup
      .selectAll<SVGGElement, {}>('g.node')
      .data<CollapsibleHierarchyPointNode<Message>>(
        nodes,
        (d: CollapsibleHierarchyPointNode<Message>) =>
          d.data.id || (d.data.id = this.i++)
      )
      .join(
        (enter) =>
          // node enter
          enter
            .append('g')
            .attr('class', 'node')
            .attr('transform', (d) => {
              return 'translate(' + source.y + ',' + source.x + ')';
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
                .style('fill', (d: CollapsibleHierarchyPointNode<Message>) => {
                  return d._children ? 'lightsteelblue' : '#fff';
                })
            )
            // text enter
            .call((g) =>
              g
                .append('text')
                .append('textPath')
                .text((d) => d.data.text)
            )
            // phantom node to give us mouseover in a radius around it
            .call((g) =>
              g
                .append('circle')
                .attr('class', 'ghostCircle')
                .attr('r', 30)
                .attr('opacity', 0.2) // change this to zero to hide the target area
                .style('fill', 'red')
                .attr('pointer-events', 'mouseover')
                .on('mouseover', (event, d) => {
                  this.overCircle(d);
                })
                .on('mouseout', (event, d) => {
                  this.outCircle(d);
                })
            ),
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
                  // update if removing node
                  return 'translate(' + d.parent.y + ',' + d.parent.x + ')';
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
        console.log(event);
        return this.click(event, d);
      })
      .call(this.dragListener, this);
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
      .transition()
      .duration(this.duration)
      .attr('transform', (d) => {
        return 'translate(' + d.y + ',' + d.x + ')';
      });

    node.select('rect').style('fill-opacity', 1);

    // Update the text to reflect whether node has children or not.
    node
      .select('text')
      .attr('x', (d) => {
        // return d.children || d._children ? -10 : 10;
        return 50;
      })
      .attr('dy', '.35em')
      .attr('class', 'nodeText')
      // .attr('text-anchor', (d) => {
      //   // return d.children || d._children ? 'end' : 'start';
      // })
      .attr('fill', 'white')
      .text((d) => {
        return d.data.text;
      })
      // Fade the text in
      .transition()
      .duration(this.duration)
      .style('fill-opacity', 1);

    // Update the links…
    let link = this.svgGroup
      .selectAll<SVGPathElement, {}>('path.link')
      .data(links, (d: HierarchyPointLink<Message>) => {
        return d.target.data.id;
      });

    // Enter any new links at the parent's previous position.
    let linkEnter = link
      .enter()
      .insert('path', 'g')
      .attr('class', 'link')
      .attr('d', (d: HierarchyPointLink<Message>) => {
        var o = {
          x: source.x0,
          y: source.y0,
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
      d.x0 = d.x;
      d.y0 = d.y;
    });
  }
}
