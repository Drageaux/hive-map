import { Component, OnInit } from '@angular/core';
import { fabric } from 'fabric';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
})
export class AppComponent implements OnInit {
  canvas: any;

  ngOnInit() {
    this.canvas = new fabric.Canvas('canvas');
    this.canvas.add(new fabric.IText('Hello World !'));
  }
}
