<template>
  <div class="http-headers-editor" data-testid="http-headers-editor">
    <div class="form-group">
      <label class="control-label" for="ContentType">Content-Type:</label>
      <input
        id="ContentType"
        v-model="headers.ContentType"
        type="text"
        class="form-control"
        data-testid="header-content-type"
      />
    </div>

    <div class="form-group">
      <label class="control-label" for="ContentEncoding">Content-Encoding:</label>
      <input
        id="ContentEncoding"
        v-model="headers.ContentEncoding"
        type="text"
        class="form-control"
        data-testid="header-content-encoding"
      />
    </div>

    <div class="form-group">
      <label class="control-label" for="CacheControl">Cache-Control:</label>
      <input
        id="CacheControl"
        v-model="headers.CacheControl"
        type="text"
        class="form-control"
        data-testid="header-cache-control"
      />
    </div>

    <div class="form-group">
      <label class="control-label" for="ContentDisposition">Content-Disposition:</label>
      <input
        id="ContentDisposition"
        v-model="headers.ContentDisposition"
        type="text"
        class="form-control"
        data-testid="header-content-disposition"
      />
    </div>

    <div class="form-group">
      <label class="control-label" for="ContentLanguage">Content-Language:</label>
      <input
        id="ContentLanguage"
        v-model="headers.ContentLanguage"
        type="text"
        class="form-control"
        data-testid="header-content-language"
      />
    </div>

    <div class="form-group">
      <label class="control-label" for="Expires">Expires:</label>
      <input
        id="Expires"
        v-model="headers.Expires"
        type="text"
        class="form-control"
        data-testid="header-expires"
      />
    </div>

    <fieldset>
      <legend>
        <h5>
          {{ t('userMetaData') }}
          <a
            href="javascript:;"
            class="pull-right btn btn-xs btn-success"
            data-testid="meta-add"
            @click="metaItems.unshift({ key: '', value: '' })"
          >{{ t('add') }}</a>
        </h5>
      </legend>

      <table class="table table-condensed table-bordered" data-testid="meta-table">
        <tr>
          <th>{{ t('key') }}</th>
          <th>{{ t('value') }}</th>
          <th>{{ t('actions') }}</th>
        </tr>
        <tr v-for="(meta, index) in metaItems" :key="index" data-testid="meta-row">
          <td>
            <div class="input-group">
              <span class="input-group-addon">x-oss-meta-</span>
              <input v-model="meta.key" type="text" class="form-control" data-testid="meta-key" />
            </div>
          </td>
          <td>
            <input v-model="meta.value" type="text" class="form-control" data-testid="meta-value" />
          </td>
          <td>
            <a
              href="javascript:;"
              class="text-danger"
              data-testid="meta-remove"
              @click="metaItems.splice(index, 1)"
            >{{ t('delete') }}</a>
          </td>
        </tr>
      </table>
    </fieldset>
  </div>
</template>

<script setup>
import { reactive, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

// 等价 update-http-headers-modal 的表单主体：6 个标准头 + 用户自定义元数据表；
// headers/metaItems 转换与 setMeta2 提交由弹窗承接。
const props = defineProps({
  headers: {
    type: Object,
    default: () => ({
      ContentLanguage: '',
      ContentType: '',
      CacheControl: '',
      ContentDisposition: '',
      ContentEncoding: '',
      Expires: '',
    }),
  },
  metaItems: { type: Array, default: () => [] },
});

const { t } = useI18n();

const headers = reactive({
  ContentLanguage: '',
  ContentType: '',
  CacheControl: '',
  ContentDisposition: '',
  ContentEncoding: '',
  Expires: '',
});
const metaItems = ref([]);

watch(
  () => props.headers,
  (next) => {
    if (next) {
      Object.assign(headers, next);
    }
  },
  { immediate: true }
);

watch(
  () => props.metaItems,
  (next) => {
    metaItems.value = (next || []).map((n) => ({ key: n.key, value: n.value }));
  },
  { immediate: true }
);

defineExpose({
  getHeaders: () => ({ ...headers }),
  getMetaItems: () => metaItems.value.map((n) => ({ key: n.key, value: n.value })),
});
</script>

<style scoped>
.form-group {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.control-label {
  width: 140px;
  text-align: right;
  white-space: nowrap;
}
.form-control {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 12px;
}
fieldset {
  border: 1px solid #ddd;
  margin-top: 10px;
}
legend h5 {
  margin: 0 10px;
  font-size: 13px;
}
.btn-success {
  background: #5cb85c;
  border-color: #4cae4c;
  color: #fff;
  text-decoration: none;
  padding: 2px 8px;
  border-radius: 3px;
  font-size: 12px;
}
.table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
.table th,
.table td {
  border: 1px solid #ddd;
  padding: 4px 6px;
  text-align: left;
}
.input-group {
  display: flex;
}
.input-group-addon {
  padding: 5px 6px;
  background: #eee;
  border: 1px solid #ccc;
  border-right: none;
  border-radius: 3px 0 0 3px;
  font-size: 12px;
  white-space: nowrap;
}
.input-group .form-control {
  border-radius: 0 3px 3px 0;
}
.text-danger {
  color: #d9534f;
}
</style>