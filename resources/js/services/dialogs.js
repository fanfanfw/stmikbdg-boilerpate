import Swal from 'sweetalert2';

const baseOptions = {
    confirmButtonColor: '#11695f',
    cancelButtonColor: '#6b7b83',
    reverseButtons: true,
    customClass: {
        popup: 'app-swal',
        confirmButton: 'app-swal-confirm',
        cancelButton: 'app-swal-cancel',
    },
};

export async function confirmAction({ title, text, confirmText = 'Lanjutkan', icon = 'question' }) {
    const result = await Swal.fire({
        ...baseOptions,
        title,
        text,
        icon,
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Batal',
    });

    return result.isConfirmed;
}

export async function promptText({ title, text, inputLabel, placeholder = '', confirmText = 'Simpan' }) {
    const result = await Swal.fire({
        ...baseOptions,
        title,
        text,
        input: 'textarea',
        inputLabel,
        inputPlaceholder: placeholder,
        inputAttributes: { 'aria-label': inputLabel || title },
        showCancelButton: true,
        confirmButtonText: confirmText,
        cancelButtonText: 'Batal',
        inputValidator: (value) => (!value?.trim() ? 'Catatan wajib diisi.' : undefined),
    });

    return result.isConfirmed ? result.value.trim() : null;
}
