<template>
  <BaseModal :visible="true" :title="t('update') + ' ' + (item.UserName || '')" :mask-closable="false" @close="onCancel">
    <form class="uu-body" data-testid="user-update-modal" @submit.prevent="onSubmit">
      <div class="st-row">
        <label class="st-label"><span class="red">*</span>{{ t('username') }}:</label>
        <input
          v-model="item.NewUserName"
          type="text"
          class="st-input"
          :class="{ 'st-invalid': touched && !userNameValid }"
          required
          data-testid="user-update-name"
        />
        <small v-if="touched && !userNameValid" class="st-error">{{ t('user.name.error') }}</small>
      </div>

      <div class="st-row">
        <label class="st-label">{{ t('displayName') }}:</label>
        <input v-model="item.NewDisplayName" type="text" class="st-input" data-testid="user-update-display" />
      </div>

      <div class="st-row">
        <label class="st-label">{{ t('phone') }}:</label>
        <select v-model="item._MobilePhonePre" class="st-input st-select" data-testid="user-update-phone-pre">
          <option v-for="n in countryNum" :key="n.value + n.label" :value="n.value">{{ n.label }}</option>
        </select>
        <input v-model="item._MobilePhoneNum" type="text" class="st-input" data-testid="user-update-phone-num" />
      </div>

      <div class="st-row">
        <label class="st-label">{{ t('email') }}:</label>
        <input
          v-model="item.NewEmail"
          type="text"
          class="st-input"
          :class="{ 'st-invalid': touched && !emailValid }"
          data-testid="user-update-email"
        />
        <small v-if="touched && !emailValid" class="st-error">{{ t('user.email.error') }}</small>
      </div>

      <div class="st-row">
        <label class="st-label">{{ t('comments') }}:</label>
        <input v-model="item.NewComments" type="text" class="st-input" data-testid="user-update-comments" />
      </div>

      <div class="st-row st-actions">
        <button type="submit" class="st-btn st-btn-primary" data-testid="user-update-submit">{{ t('submit') }}</button>
        <button type="button" class="st-btn" data-testid="user-update-cancel" @click="onCancel">{{ t('cancel') }}</button>
      </div>
    </form>
  </BaseModal>
</template>

<script setup>
import { computed, reactive, ref } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '../../base/BaseModal.vue';
import ramClient from '../../../services/ram-client.js';
import { countryNum, REG } from '../../../services/const-data.js';
import { useToastStore } from '../../../stores/toast.js';

// 等价 userUpdateCtrl：getUser 回显 → updateUser 提交 → callback + close
const props = defineProps({
  item: { type: Object, default: () => ({}) },
  callback: { type: Function, default: null },
});

const emit = defineEmits(['close']);
const { t } = useI18n();
const toast = useToastStore();
const touched = ref(false);

function initNewItem(source) {
  const info = {
    UserName: source.UserName,
    NewUserName: source.UserName,
    NewDisplayName: source.DisplayName,
    NewMobilePhone: source.MobilePhone,
    NewEmail: source.Email,
    NewComments: source.Comments,
    _MobilePhonePre: countryNum[0].value,
    _MobilePhoneNum: '',
  };

  if (source.MobilePhone) {
    const parts = String(source.MobilePhone).split('-');
    info._MobilePhonePre = parts[0];
    info._MobilePhoneNum = parts[1];
  }

  return info;
}

const item = reactive(initNewItem(props.item || {}));

if (props.item && props.item.UserId) {
  ramClient
    .getUser(props.item.UserName)
    .then((result) => {
      const next = initNewItem(result.User);
      for (const key of Object.keys(item)) {
        if (next[key] !== undefined && next[key] !== item[key]) {
          item[key] = next[key];
        }
      }
    })
    .catch(() => {});
}

const userNameValid = computed(() => REG.USERNAME.test(String(item.NewUserName || '')));
const emailValid = computed(() => !item.NewEmail || REG.EMAIL.test(String(item.NewEmail)));

function onSubmit() {
  touched.value = true;
  if (!userNameValid.value || !emailValid.value) {
    return;
  }

  const data = {
    UserName: item.UserName,
    NewUserName: item.NewUserName,
    NewDisplayName: item.NewDisplayName,
    NewEmail: item.NewEmail,
    NewComments: item.NewComments,
    NewMobilePhone:
      item._MobilePhonePre && item._MobilePhoneNum ? item._MobilePhonePre + '-' + item._MobilePhoneNum : '',
  };

  ramClient
    .updateUser(data)
    .then(() => {
      if (typeof props.callback === 'function') {
        props.callback();
      }
      emit('close');
    })
    .catch(() => {});
}

function onCancel() {
  emit('close');
}
</script>

<style scoped>
.uu-body {
  min-width: 460px;
}
.st-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.st-label {
  width: 110px;
  min-width: 110px;
  text-align: right;
  font-size: 12px;
  color: #555;
}
.st-input {
  flex: 1;
  padding: 5px 8px;
  border: 1px solid #ccc;
  border-radius: 3px;
  font-size: 12px;
  min-width: 0;
}
.st-select {
  flex: 0 0 160px;
}
.st-invalid {
  border-color: #d9534f;
}
.st-error {
  color: #d9534f;
  font-size: 11px;
  width: 100%;
  text-align: right;
}
.st-btn {
  padding: 4px 14px;
  border: 1px solid #ccc;
  border-radius: 3px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.st-btn-primary {
  border-color: #337ab7;
  background: #337ab7;
  color: #fff;
}
.red {
  color: #d9534f;
}
.st-actions {
  justify-content: flex-end;
}
</style>