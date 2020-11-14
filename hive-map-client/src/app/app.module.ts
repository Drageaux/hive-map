import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MessagesModule } from './messages/messages.module';
import { CursorComponent } from './cursor/cursor.component';
import { FormsModule } from '@angular/forms';

@NgModule({
  declarations: [AppComponent, CursorComponent],
  imports: [BrowserModule, AppRoutingModule, MessagesModule, FormsModule],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule {}
