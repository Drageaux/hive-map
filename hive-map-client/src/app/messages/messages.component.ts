import { Component, OnInit } from '@angular/core';
import * as d3 from 'd3';
import { HierarchyNode } from 'd3';

@Component({
  selector: 'app-messages',
  templateUrl: './messages.component.html',
  styleUrls: ['./messages.component.scss'],
})
export class MessagesComponent implements OnInit {
  // credit https://observablehq.com/@d3/collapsible-tree

  constructor() {}

  ngOnInit(): void {}
}
