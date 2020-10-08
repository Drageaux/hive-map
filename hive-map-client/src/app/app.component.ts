import { Component, OnInit } from '@angular/core';
import { fabric } from 'fabric';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  // credit: http://bl.ocks.org/robschmuecker/7880033

  canvas: any;
  //configuration
  boxPadding = 16;
  arrowWidth = 16;
  strokeWidth = 2;
  handleSize = 24;
  currMessage = 'test';

  ngOnInit() {
    this.canvas = new fabric.Canvas('canvas');
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;

    this.canvas.add(new fabric.IText('Hello World!'));

    // this.canvas.add(handle).setActiveObject(handle);
    // this.canvas.on('after:render', this.updateBubble);
    // updateBubble();
  }
}
