import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnDestroy,
  OnInit,
  TemplateRef,
  ViewChild
} from '@angular/core';
import {Observable, Subscription} from 'rxjs';
import {RemoteData} from '../../../core/data/remote-data';
import {PaginatedList} from '../../../core/data/paginated-list.model';
import {FindListOptions} from '../../../core/data/find-list-options.model';
import {LdnService} from '../ldn-services-model/ldn-services.model';
import {PaginationComponentOptions} from '../../../shared/pagination/pagination-component-options.model';
import {map, switchMap} from 'rxjs/operators';
import {LdnServicesService} from 'src/app/admin/admin-ldn-services/ldn-services-data/ldn-services-data.service';
import {PaginationService} from 'src/app/core/pagination/pagination.service';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {hasValue} from '../../../shared/empty.util';
import {Operation} from 'fast-json-patch';
import {getFirstCompletedRemoteData} from '../../../core/shared/operators';
import {NotificationsService} from '../../../shared/notifications/notifications.service';
import {TranslateService} from '@ngx-translate/core';
import { mockLdnServiceRD$ } from "../ldn-service-serviceMock/ldnServicesRD$-mock";


@Component({
  selector: 'ds-ldn-services-directory',
  templateUrl: './ldn-services-directory.component.html',
  styleUrls: ['./ldn-services-directory.component.scss'],
  changeDetection: ChangeDetectionStrategy.Default
})
export class LdnServicesOverviewComponent implements OnInit, OnDestroy {

  selectedServiceId: string | number | null = null;
  servicesData: any[] = [];
  @ViewChild('deleteModal', {static: true}) deleteModal: TemplateRef<any>;
  ldnServicesRD$: Observable<RemoteData<PaginatedList<LdnService>>>;
  //TODO: remove mocks an put in test after finishing
  //mockLdnServiceRD$: Observable<RemoteData<LdnService>>;
 // mockLdnServicesRD$: Observable<RemoteData<PaginatedList<LdnService>>>;
  config: FindListOptions = Object.assign(new FindListOptions(), {
    elementsPerPage: 20
  });
  pageConfig: PaginationComponentOptions = Object.assign(new PaginationComponentOptions(), {
    id: 'po',
    pageSize: 20
  });
  isProcessingSub: Subscription;
  modalRef: any;



  constructor(
      protected ldnServicesService: LdnServicesService,
      protected paginationService: PaginationService,
      protected modalService: NgbModal,
      public cdRef: ChangeDetectorRef,
      private notificationService: NotificationsService,
      private translateService: TranslateService,
  ) {
  }

  ngOnInit(): void {
    this.setLdnServices();
  }

  /**
   * Sets up the LDN services by fetching and observing the paginated list of services.
   */
  setLdnServices() {
    this.ldnServicesRD$ = this.paginationService.getFindListOptions(this.pageConfig.id, this.config).pipe(
      switchMap((config) => this.ldnServicesService.findAll(config, false, false).pipe(
        getFirstCompletedRemoteData()
      ))

    );/*
    this.mockLdnServiceRD$ = mockLdnServiceRD$

    this.mockLdnServicesRD$ = this.paginationService.getFindListOptions(this.pageConfig.id, this.config).pipe(
      switchMap((config) => this.ldnServicesService.findAll(config, false, false).pipe(
        getFirstCompletedRemoteData()
      ))

    );this.paginationService.getFindListOptions(this.pageConfig.id, this.config)
     this.ldnServicesRD$.subscribe((rd: RemoteData<PaginatedList<LdnService>>) => {console.log('realremotedata:',rd);})
     this.mockLdnServiceRD$.subscribe((rd: RemoteData<LdnService>) => {console.log('mockremotedata:',rd);})
     this.mockLdnServicesRD$.subscribe((rd: RemoteData<PaginatedList<LdnService>>) => {console.log('mockremotedata[ldnservice]:',rd);})*/

  }

  ngOnDestroy(): void {
    this.paginationService.clearPagination(this.pageConfig.id);
    if (hasValue(this.isProcessingSub)) {
      this.isProcessingSub.unsubscribe();
    }
  }

  /**
   * Opens the delete confirmation modal.
   *
   * @param {any} content - The content of the modal.
   */
  openDeleteModal(content) {
    this.modalRef = this.modalService.open(content);
  }

  /**
   * Closes the currently open modal and triggers change detection.
   */
  closeModal() {
    this.modalRef.close();
    this.cdRef.detectChanges();
  }

  /**
   * Sets the selected LDN service ID for deletion and opens the delete confirmation modal.
   *
   * @param {number} serviceId - The ID of the service to be deleted.
   */
  selectServiceToDelete(serviceId: number) {
    this.selectedServiceId = serviceId;
    this.openDeleteModal(this.deleteModal);
  }

  /**
   * Deletes the selected LDN service.
   *
   * @param {string} serviceId - The ID of the service to be deleted.
   * @param {LdnServicesService} ldnServicesService - The service for managing LDN services.
   */
  deleteSelected(serviceId: string, ldnServicesService: LdnServicesService): void {
    if (this.selectedServiceId !== null) {
      ldnServicesService.delete(serviceId).pipe(getFirstCompletedRemoteData()).subscribe((rd: RemoteData<LdnService>) => {
        if (rd.hasSucceeded) {
          this.servicesData = this.servicesData.filter(service => service.id !== serviceId);
          this.ldnServicesRD$ = this.ldnServicesRD$.pipe(
            map((remoteData: RemoteData<PaginatedList<LdnService>>) => {
              if (remoteData.hasSucceeded) {
                remoteData.payload.page = remoteData.payload.page.filter(service => service.id.toString() !== serviceId);
              }
              return remoteData;
            })
          );
          this.cdRef.detectChanges();
          this.closeModal();
          this.notificationService.success(this.translateService.get('ldn-service-delete.notification.success.title'),
            this.translateService.get('ldn-service-delete.notification.success.content'));
        } else {
          this.notificationService.error(this.translateService.get('ldn-service-delete.notification.error.title'),
            this.translateService.get('ldn-service-delete.notification.error.content'));
          this.cdRef.detectChanges();
        }
      });
    }
  }

  /**
   * Toggles the status (enabled/disabled) of an LDN service.
   *
   * @param {any} ldnService - The LDN service object.
   * @param {LdnServicesService} ldnServicesService - The service for managing LDN services.
   */
  toggleStatus(ldnService: any, ldnServicesService: LdnServicesService): void {
    const newStatus = !ldnService.enabled;
    const originalStatus = ldnService.enabled;

    const patchOperation: Operation = {
      op: 'replace',
      path: '/enabled',
      value: newStatus,
    };

    ldnServicesService.patch(ldnService, [patchOperation]).pipe(getFirstCompletedRemoteData()).subscribe(
      (rd: RemoteData<LdnService>) => {
        if (rd.hasSucceeded) {
          ldnService.enabled = newStatus;
          this.notificationService.success(this.translateService.get('ldn-enable-service.notification.success.title'),
            this.translateService.get('ldn-enable-service.notification.success.content'));
        } else {
          ldnService.enabled = originalStatus;
          this.notificationService.error(this.translateService.get('ldn-enable-service.notification.error.title'),
            this.translateService.get('ldn-enable-service.notification.error.content'));
        }
      }
    );
  }
}
