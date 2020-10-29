import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MessageInputComponent } from './message-input/message-input.component';
import { MessagesComponent } from './messages.component';

@NgModule({
  declarations: [MessageInputComponent, MessagesComponent],
  imports: [CommonModule],
  exports: [MessageInputComponent],
})
export class MessagesModule {}
