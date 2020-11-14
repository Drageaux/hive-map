import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Message } from './messages/message';
import * as d3 from 'd3';
import {
  select,
  HierarchyPointLink,
  D3DragEvent,
  HierarchyPointNode,
  ValueFn,
  selectAll,
} from 'd3';
import { MessageNode } from './classes/collapsible-hierarchy-point-node';
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
  mode: 'chat' | 'drag' = 'chat';

  // input
  @ViewChild('input') inputEl: ElementRef;
  selectedNode: MessageNode;

  // collapsed nodes
  collapsedNodes = new Map<string, boolean>();

  // d3 set up
  d3tree = d3.tree<Message>().size([1000, 1000]);
  diagonal = d3
    .linkHorizontal()
    .x((d) => d[1])
    .y((d) => d[0]); // node paths
  root: MessageNode;
  // svg-related objects
  svg: d3.Selection<SVGSVGElement, {}, HTMLElement, any>;
  // append a group which holds all nodes and which the zoom Listener can act upon.
  svgGroup: d3.Selection<SVGGElement, {}, HTMLElement, any>;

  // zoom
  zoomListener;
  // drag
  dragListener;
  // variables for drag/drop
  targetNode = null;
  dragStarted = false;
  relCoords;
  // panning variables
  panSpeed = 200;
  panBoundary = 20; // Within 20px from edges will pan when dragging.
  panTimer;
  // misc. variables
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
      event: D3DragEvent<SVGGElement, MessageNode, MessageNode>,
      d: MessageNode
    ): void => {
      if (d === this.root || this.mode !== 'drag') {
        // TODO: move root
        return;
      }
      this.dragStarted = true;
      // let nodes = tree.nodes(d);
      // NOTE: important, suppress the mouseover event on the node being dragged.
      // Otherwise it will absorb the mouseover event and the underlying node will not detect it
      // event.sourceEvent.stopPropagation();
    };
    let onDrag = (
      g: SVGGElement,
      event: D3DragEvent<SVGGElement, MessageNode, MessageNode>,
      d: MessageNode
    ) => {
      if (d === this.root || this.mode !== 'drag') {
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
      event: D3DragEvent<SVGGElement, MessageNode, MessageNode>,
      d: MessageNode
    ) => {
      if (d === this.root) {
        return;
      }

      if (this.targetNode) {
        // TODO: all in service
        this.crudService.dragChild(d.parent, this.targetNode, d);

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

        // Make sure that the node being added to is expanded so user can see added node is correctly moved
        this.expand(this.targetNode);
        this.endDrag(d, g);
      } else {
        this.endDrag(d, g);
      }
    };

    this.dragListener = d3
      .drag<SVGGElement, MessageNode>()
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
  initiateDrag(datum: MessageNode, domNode: SVGGElement) {
    d3.select(domNode).select('.ghostCircle').attr('pointer-events', 'none');
    d3.selectAll('.ghostCircle').attr('class', 'ghostCircle show');
    d3.select(domNode).attr('class', 'node activeDrag');

    this.svgGroup.selectAll<SVGGElement, MessageNode>('g.node').sort((a, b) => {
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
        .data<MessageNode>(nodes, (d: MessageNode) => d.data.id)
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

  endDrag(d: MessageNode, g: SVGGElement) {
    this.targetNode = null;
    d3.selectAll('.ghostCircle').attr('class', 'ghostCircle');
    d3.select(g).attr('class', 'node');
    // now restore the mouseover event or we won't be able to drag a 2nd time
    d3.select(g).select('.ghostCircle').attr('pointer-events', '');
    this.update(this.root);
    let updatedNode = this.root.find((e) => e.data.id === d.data.id);
    this.updateTempConnector(updatedNode);
    this.centerNode(updatedNode);
  }

  sort() {
    this.root = this.root.sort(function (a, b) {
      return Date.parse(b.data.timestamp) < Date.parse(a.data.timestamp)
        ? -1
        : 1;
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
  centerNode(source: MessageNode) {
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
  collapse(d: MessageNode) {
    if (d.data.children) {
      d.data._children = d.data.children;
      // TODO: bug check
      d.children.forEach(this.collapse);
      d.data.children = null;
    }
  }

  expand(d: MessageNode) {
    console.log(d);
    if (d.data._children) {
      d.data.children = d.data._children;
      // TODO: bug check
      d.children.forEach(this.expand);
      d.data._children = null;
    }
  }

  toggleChildren(d: MessageNode) {
    if (d.data.children) {
      d.data._children = d.data.children;
      d.data.children = null;
    } else if (d.data._children) {
      d.data.children = d.data._children;
      d.data._children = null;
    }
    return d;
  }

  // Toggle children on click.
  click(event, d: MessageNode) {
    console.log(event, d);
    if (event.defaultPrevented) return; // click suppressed
    d = this.toggleChildren(d);
    this.update(d);
    this.centerNode(d);

    this.selectNode(d);
  }

  overCircle(targetNode: MessageNode) {
    this.targetNode = targetNode;
    // this.updateTempConnector(targetNode);
  }
  outCircle(targetNode: MessageNode) {
    this.targetNode = null;
    // this.updateTempConnector(targetNode);
  }

  // Function to update the temporary connector indicating dragging affiliation
  updateTempConnector(d: MessageNode) {
    var data = [];
    if (d !== null && this.targetNode !== null) {
      // have to flip the source coordinates since we did this for the existing connectors on the original tree
      data = [
        {
          source: d,
          target: this.targetNode,
        },
      ];
    }
    let tempLink = this.svgGroup
      .selectAll<SVGPathElement, {}>('path.templink')
      .data(data, (d: HierarchyPointLink<Message>) => {
        console.log(
          (({ x, y, data: { name } }) => ({ x, y, data: { name } }))(d.source),
          (({ x, y, data: { name } }) => ({ x, y, data: { name } }))(d.target)
        );
        return d.target.data.id;
      });

    tempLink
      .enter()
      .append('path')
      .attr('class', 'templink')
      .attr('d', (d: HierarchyPointLink<Message>) => {
        return this.diagonal({
          source: [(d.source as MessageNode).x0, (d.source as MessageNode).y0],
          target: [d.target.x, d.target.y],
        });
      })
      .attr('pointer-events', 'none');

    tempLink.attr('d', (d: HierarchyPointLink<Message>) => {
      console.log(d.source as MessageNode);
      console.log(d.target as MessageNode);
      return this.diagonal({
        source: [(d.source as MessageNode).x0, (d.source as MessageNode).y0],
        target: [d.target.x, d.target.y],
      });
    });

    tempLink.exit().remove();
  }

  /*************************************************************************/
  /****************************** DATA UPDATE ******************************/
  /*************************************************************************/
  update(source: MessageNode) {
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
    this.sort();
    // this.root.x0 = window.innerHeight / 2;
    // this.root.y0 = 0;
    const nodes: MessageNode[] = this.root.descendants();
    const links = this.root.links();

    // Set widths between levels based on maxLabelLength.
    nodes.forEach((d) => {
      d.y = d.depth * (this.crudService.maxLabelLength * 10); //maxLabelLength * 10px
      // alternatively to keep a fixed scale one can set a fixed depth per level
      // Normalize for fixed-depth by commenting out below line
      // d.y = d.depth * 500; //500px per level.
      return d.data.id;
    });
    // Update the nodes…
    let node = this.svgGroup
      .selectAll<SVGGElement, {}>('g.node')
      .data<MessageNode>(nodes, (d: MessageNode) => d.data.id)
      .join(
        (enter) =>
          // node enter
          enter
            .append('g')
            .attr('class', 'node')
            .attr(
              'transform',
              (d) => 'translate(' + source.y + ',' + source.x + ')'
            )
            .attr('id', (d) => d.data.id)
            // rect enter
            .call((g) =>
              g
                .append('rect')
                .attr('y', -20)
                .attr('x', 0)
                .attr('width', 200)
                .attr('height', 40)
                .style('fill-opacity', 0)
                .style('rx', 15)
            )
            // circle enter
            .call((g) =>
              g
                .append('circle')
                .attr('class', 'nodeCircle')
                .attr('r', 0)
                .style('fill', (d: MessageNode) => {
                  return d._children ? 'lightsteelblue' : '#fff';
                })
            )
            // text enter
            .call(
              (g) => g.append('text')
              // .append('textPath')
              // .text((d) => d.data.text)
            )
            // phantom node to give us mouseover in a radius around it
            .call((g) =>
              g
                .append('circle')
                .attr('class', 'ghostCircle')
                .attr('pointer-events', 'mouseover')
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
                // to update if removing node
                .attr(
                  'transform',
                  (d) => 'translate(' + d.parent.y + ',' + d.parent.x + ')'
                )
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
      .on('click', (event, d) => this.click(event, d))
      .call(this.dragListener);

    // .on('dblclick', (event) => {
    //   event.preventDefault();
    //   console.log(event);
    // });

    // All ghost circles will get its latest positions
    node
      .select('circle.ghostCircle')
      .attr('x', 200)
      .attr('r', 30)
      .attr('opacity', 0.2) // change this to zero to hide the target area
      .style('fill', 'red')
      .attr('pointer-events', 'mouseover')
      .on('mouseover', (event, d) => {
        this.overCircle(d);
      })
      .on('mouseout', (event, d) => {
        this.outCircle(d);
      });

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
    let root = node
      .filter((d) => d.depth === 0)
      .select('rect')
      .attr('fill', '#5691f0');

    // Update the text to reflect whether node has children or not.
    node
      .select('text')
      .style('font-family', 'Public Sans, sans-serif')
      .attr('x', (d) => {
        // return d.children || d._children ? -10 : 10;
        return '0.5rem';
      })
      .attr('dy', '.35em')
      .attr('class', 'nodeText')
      // .attr('text-anchor', (d) => {
      //   // return d.children || d._children ? 'end' : 'start';
      // })
      .attr('fill', 'white')
      .text((d) => d.data.text)
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

  selectNode(d: MessageNode) {
    // select for chat
    if (this.mode !== 'chat') return;
    this.selectedNode = d;
    let nodeSelection = select<SVGGElement, MessageNode>(`[id="${d.data.id}"`);

    let nodes = selectAll<SVGGElement, MessageNode>(`g.node`).filter(
      (e) => e.data.id !== d.data.id
    );
    nodes.select('rect').attr('stroke-width', 0).attr('stroke', 'yellow');

    nodeSelection
      .select('rect')
      .attr('stroke-width', '4px')
      .attr('stroke', 'yellow');
    this.inputEl.nativeElement.focus();
  }

  /*************************************************************************/
  /********************************* FORMS *********************************/
  /*************************************************************************/
  onChatSubmit() {
    let newMessage: Message = this.crudService.addChild(
      this.selectedNode,
      this.currMessage
    );
    // return this node's data's children to normal (expand)
    // so that the tree update does not think it does not have children
    if (this.selectedNode.data._children) {
      this.selectedNode.data.children = this.selectedNode.data._children;
      this.selectedNode.data._children = null;
    }
    // update view
    this.update(this.root);
    let newNode =
      this.root.find((d) => d.data.id === newMessage.id) || this.selectedNode;
    this.centerNode(newNode);
    // reset model
    this.currMessage = '';
    this.selectNode(newNode);
  }
}
