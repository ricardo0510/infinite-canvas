import { Injectable } from "@nestjs/common";
import { Subject } from "rxjs";
import type { InternalTask } from "./task.types";

@Injectable()
export class TaskEvents {
  private readonly createdSource = new Subject<InternalTask>();
  private readonly updatedSource = new Subject<InternalTask>();

  readonly created$ = this.createdSource.asObservable();
  readonly updated$ = this.updatedSource.asObservable();

  emitCreated(task: InternalTask): void {
    this.createdSource.next(task);
  }

  emitUpdated(task: InternalTask): void {
    this.updatedSource.next(task);
  }
}
